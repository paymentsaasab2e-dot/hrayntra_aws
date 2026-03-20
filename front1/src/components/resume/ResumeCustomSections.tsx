interface CustomSection {
  title: string;
  items: Array<{
    title?: string;
    description?: string;
    date?: string;
    [key: string]: any;
  }>;
}

interface ResumeCustomSectionsProps {
  customSections: CustomSection[];
}

export default function ResumeCustomSections({ customSections }: ResumeCustomSectionsProps) {
  if (!customSections || customSections.length === 0) return null;

  return (
    <>
      {customSections.map((section, sectionIndex) => (
        <section key={sectionIndex} className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">
            {section.title}
          </h2>
          {section.items.map((item, itemIndex) => (
            <div key={itemIndex} className="mb-4">
              {item.title && (
                <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
              )}
              {item.date && (
                <p className="text-sm text-gray-500">{item.date}</p>
              )}
              {item.description && (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
