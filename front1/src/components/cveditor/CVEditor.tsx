'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { useState, useEffect } from 'react';

interface CVEditorProps {
  content: string;
  onUpdate: (html: string) => void;
  onImproveText: (text: string) => Promise<string>;
}

// Convert markdown syntax to HTML
function convertMarkdownToHTML(html: string): string {
  if (!html) return '';
  
  // If content already contains HTML tags (like <h3>, <p>, <strong>), it's likely already formatted
  // Only convert markdown in plain text portions
  const hasHTMLTags = /<[a-z][\s\S]*>/i.test(html);
  
  if (hasHTMLTags) {
    // Content is already HTML - return as is (AI already formatted it)
    // Only convert any remaining markdown that might be in text content
    let result = html;
    
    // Convert **text** to <strong>text</strong> (simple approach - will work for most cases)
    result = result.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    
    // Convert __text__ to <strong>text</strong>
    result = result.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
    
    return result;
  }
  
  // Plain text - convert all markdown
  // Convert **text** to <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert *text* to <em>text</em> (only if not part of **)
  html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
  
  // Convert __text__ to <strong>text</strong>
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Convert _text_ to <em>text</em> (only if not part of __)
  html = html.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');
  
  return html;
}

export default function CVEditor({ content, onUpdate, onImproveText }: CVEditorProps) {
  const [selectedText, setSelectedText] = useState('');
  const [isImproving, setIsImproving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
    ],
    content: convertMarkdownToHTML(content),
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[800px] p-8 text-black',
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to);
        setSelectedText(text);
      } else {
        setSelectedText('');
      }
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      const convertedContent = convertMarkdownToHTML(content);
      editor.commands.setContent(convertedContent);
    }
  }, [content, editor]);

  const handleImproveText = async () => {
    if (!selectedText || !editor) return;

    try {
      setIsImproving(true);
      const improved = await onImproveText(selectedText);
      
      // Convert markdown to HTML before inserting
      const convertedImproved = convertMarkdownToHTML(improved);
      
      // Replace selected text with improved text
      const { from, to } = editor.state.selection;
      editor.chain().focus().deleteRange({ from, to }).insertContent(convertedImproved).run();
    } catch (error: any) {
      console.error('Error improving text:', error);
      const errorMessage = error?.message || 'Failed to improve text. Please check your API keys configuration.';
      alert(errorMessage);
    } finally {
      setIsImproving(false);
    }
  };

  const insertSection = (sectionType: string) => {
    if (!editor) return;

    const sectionTemplates: { [key: string]: string } = {
      projects: '<h2>Projects</h2><h3>Project Title</h3><p>Project description</p>',
      awards: '<h2>Awards</h2><h3>Award Name</h3><p>Award description</p>',
      publications: '<h2>Publications</h2><h3>Publication Title</h3><p>Publication details</p>',
      volunteer: '<h2>Volunteer Experience</h2><h3>Organization Name</h3><p>Volunteer description</p>',
      custom: '<h2>Custom Section</h2><p>Section content</p>',
    };

    const template = sectionTemplates[sectionType] || sectionTemplates.custom;
    editor.chain().focus().insertContent(template).run();
    
    // Close menu
    const menu = document.getElementById('section-menu');
    if (menu) menu.classList.add('hidden');
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const menu = document.getElementById('section-menu');
      const button = event.target as HTMLElement;
      if (menu && !menu.contains(button) && !button.closest('[data-section-button]')) {
        menu.classList.add('hidden');
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (!editor) {
    return <div className="text-center py-8">Loading editor...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-4 flex flex-wrap items-center gap-2 bg-gray-50">
        {/* Text Formatting */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-gray-200 text-black ${editor.isActive('bold') ? 'bg-gray-300' : ''}`}
            title="Bold"
          >
            <strong className="text-black">B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-gray-200 text-black ${editor.isActive('italic') ? 'bg-gray-300' : ''}`}
            title="Italic"
          >
            <em className="text-black">I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-gray-200 text-black ${editor.isActive('bulletList') ? 'bg-gray-300' : ''}`}
            title="Bullet List"
          >
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-2 rounded hover:bg-gray-200 text-black ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-300' : ''}`}
            title="Heading 1"
          >
            <span className="text-black">H1</span>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-2 rounded hover:bg-gray-200 text-black ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-300' : ''}`}
            title="Heading 2"
          >
            <span className="text-black">H2</span>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-2 rounded hover:bg-gray-200 text-black ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-300' : ''}`}
            title="Heading 3"
          >
            <span className="text-black">H3</span>
          </button>
        </div>

        {/* Text Alignment */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`p-2 rounded hover:bg-gray-200 text-black ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-300' : ''}`}
            title="Align Left"
          >
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`p-2 rounded hover:bg-gray-200 text-black ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-300' : ''}`}
            title="Align Center"
          >
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Link */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            onClick={() => {
              const url = window.prompt('Enter URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            className={`p-2 rounded hover:bg-gray-200 text-black ${editor.isActive('link') ? 'bg-gray-300' : ''}`}
            title="Add Link"
          >
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
        </div>

        {/* Add Section Dropdown */}
        <div className="relative border-r border-gray-300 pr-2">
          <button
            data-section-button
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
            onClick={(e) => {
              e.stopPropagation();
              const menu = document.getElementById('section-menu');
              if (menu) {
                menu.classList.toggle('hidden');
              }
            }}
          >
            + Add Section
          </button>
          <div
            id="section-menu"
            className="hidden absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                insertSection('projects');
                const menu = document.getElementById('section-menu');
                if (menu) menu.classList.add('hidden');
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-black"
            >
              Projects
            </button>
            <button
              onClick={() => {
                insertSection('awards');
                const menu = document.getElementById('section-menu');
                if (menu) menu.classList.add('hidden');
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-black"
            >
              Awards
            </button>
            <button
              onClick={() => {
                insertSection('publications');
                const menu = document.getElementById('section-menu');
                if (menu) menu.classList.add('hidden');
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-black"
            >
              Publications
            </button>
            <button
              onClick={() => {
                insertSection('volunteer');
                const menu = document.getElementById('section-menu');
                if (menu) menu.classList.add('hidden');
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-black"
            >
              Volunteer Experience
            </button>
            <button
              onClick={() => {
                insertSection('custom');
                const menu = document.getElementById('section-menu');
                if (menu) menu.classList.add('hidden');
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-black"
            >
              Custom Section
            </button>
          </div>
        </div>

        {/* AI Improve Button */}
        {selectedText && (
          <button
            onClick={handleImproveText}
            disabled={isImproving}
            className="px-3 py-2 bg-yellow-400 text-gray-900 rounded hover:bg-yellow-500 text-sm font-medium disabled:opacity-50"
          >
            {isImproving ? 'Improving...' : '✨ Improve with AI'}
          </button>
        )}
      </div>

      {/* Editor Content */}
      <div className="resume-editor-container">
        <EditorContent editor={editor} />
      </div>

      <style jsx global>{`
        .resume-editor-container {
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror {
          outline: none;
          color: #000000 !important;
        }
        /* Ensure bullet points are visible - TipTap specific */
        .resume-editor-container .ProseMirror ul[data-type="bulletList"],
        .resume-editor-container .ProseMirror ul {
          list-style: disc !important;
          list-style-position: outside !important;
          padding-left: 1.5rem !important;
          margin: 0.5rem 0 !important;
        }
        .resume-editor-container .ProseMirror ul[data-type="bulletList"] li,
        .resume-editor-container .ProseMirror ul li {
          display: list-item !important;
          list-style: disc !important;
          list-style-position: outside !important;
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror ul[data-type="bulletList"] li::marker,
        .resume-editor-container .ProseMirror ul li::marker {
          color: #000000 !important;
          font-size: 1.2em;
        }
        .resume-editor-container .ProseMirror ol[data-type="orderedList"],
        .resume-editor-container .ProseMirror ol {
          list-style: decimal !important;
          list-style-position: outside !important;
          padding-left: 1.5rem !important;
          margin: 0.5rem 0 !important;
        }
        .resume-editor-container .ProseMirror ol[data-type="orderedList"] li,
        .resume-editor-container .ProseMirror ol li {
          display: list-item !important;
          list-style: decimal !important;
          list-style-position: outside !important;
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror ol[data-type="orderedList"] li::marker,
        .resume-editor-container .ProseMirror ol li::marker {
          color: #000000 !important;
          font-weight: bold;
        }
        .resume-editor-container .ProseMirror h1 {
          font-size: 2rem;
          font-weight: bold;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: bold;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          border-bottom: 2px solid #333;
          padding-bottom: 0.5rem;
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror p {
          margin: 0.5rem 0;
          line-height: 1.6;
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror ul {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
          list-style-type: disc;
          list-style-position: outside;
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror ul li {
          margin: 0.25rem 0;
          color: #000000 !important;
          list-style-type: disc;
          list-style-position: outside;
          display: list-item;
          position: relative;
          padding-left: 1.5rem;
        }
        .resume-editor-container .ProseMirror ul li::marker {
          color: #000000 !important;
          font-weight: bold;
        }
        /* Force bullet visibility - use ::before to ensure bullets always show */
        .resume-editor-container .ProseMirror ul li::before {
          content: "• " !important;
          color: #000000 !important;
          font-weight: bold !important;
          position: absolute !important;
          left: 0 !important;
          display: block !important;
        }
        /* TipTap specific bullet list styling - ensure bullets are visible */
        .resume-editor-container .ProseMirror ul[data-type="bulletList"] {
          list-style: disc !important;
          list-style-position: outside !important;
        }
        .resume-editor-container .ProseMirror ul[data-type="bulletList"] li[data-type="listItem"] {
          display: list-item !important;
          list-style: disc !important;
          list-style-position: outside !important;
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror ul[data-type="bulletList"] li[data-type="listItem"]::marker {
          color: #000000 !important;
          font-size: 1em !important;
          font-weight: bold !important;
        }
        .resume-editor-container .ProseMirror ul[data-type="bulletList"] li[data-type="listItem"] p {
          display: inline !important;
          margin: 0 !important;
          color: #000000 !important;
        }
        /* Ensure bullets show even when TipTap wraps content in p tags */
        .resume-editor-container .ProseMirror ul[data-type="bulletList"] li[data-type="listItem"]::before {
          content: "• " !important;
          color: #000000 !important;
          font-weight: bold !important;
          position: absolute !important;
          left: 0 !important;
          display: block !important;
        }
        /* Comprehensive bullet point visibility fix */
        .resume-editor-container .ProseMirror ul li {
          position: relative !important;
          padding-left: 1.5rem !important;
        }
        /* Add visible bullet using ::before for all list items */
        .resume-editor-container .ProseMirror ul li::before {
          content: "• " !important;
          color: #000000 !important;
          font-weight: bold !important;
          position: absolute !important;
          left: 0 !important;
          display: inline-block !important;
        }
        /* Ensure TipTap list items also show bullets */
        .resume-editor-container .ProseMirror ul[data-type="bulletList"] li[data-type="listItem"]::before {
          content: "• " !important;
          color: #000000 !important;
          font-weight: bold !important;
          position: absolute !important;
          left: 0 !important;
          display: inline-block !important;
        }
        .resume-editor-container .ProseMirror ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
          list-style-type: decimal;
          list-style-position: outside;
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror ol li {
          margin: 0.25rem 0;
          color: #000000 !important;
          list-style-type: decimal;
          list-style-position: outside;
          display: list-item;
        }
        .resume-editor-container .ProseMirror ol li::marker {
          color: #000000 !important;
          font-weight: bold;
        }
        .resume-editor-container .ProseMirror li {
          margin: 0.25rem 0;
          color: #000000 !important;
          display: list-item;
        }
        .resume-editor-container .ProseMirror li p {
          display: inline;
          margin: 0;
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror span {
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror strong {
          color: #000000 !important;
          font-weight: bold !important;
        }
        .resume-editor-container .ProseMirror em {
          color: #000000 !important;
          font-style: italic !important;
        }
        .resume-editor-container .ProseMirror b {
          color: #000000 !important;
          font-weight: bold !important;
        }
        .resume-editor-container .ProseMirror * {
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror {
          color: #000000 !important;
        }
        .resume-editor-container .ProseMirror a {
          color: #2563eb;
          text-decoration: underline;
        }
        .resume-editor-container .ProseMirror[data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        /* Project section styling */
        .resume-editor-container .ProseMirror h3 {
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .resume-editor-container .ProseMirror hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1.5rem 0;
          color: #000000;
        }
        /* Ensure project structure is clear */
        .resume-editor-container .ProseMirror h3 + p {
          margin-top: 0.5rem;
        }
        .resume-editor-container .ProseMirror p strong {
          font-weight: bold;
          color: #000000 !important;
        }
      `}</style>
    </div>
  );
}
