interface ResumeSkillsProps {
  skills: (string | { name?: string; languageName?: string; skill?: string; proficiency?: string; [key: string]: any })[];
}

export default function ResumeSkills({ skills }: ResumeSkillsProps) {
  if (!skills || skills.length === 0) return null;

  // Normalize skills to strings - handle both string arrays and object arrays
  const normalizedSkills = skills.map((skill) => {
    if (typeof skill === 'string') {
      return skill;
    }
    // Handle object format - try different possible property names
    if (typeof skill === 'object' && skill !== null) {
      return skill.name || skill.languageName || skill.skill || skill.title || String(skill);
    }
    return String(skill);
  }).filter(skill => skill && skill.trim() !== ''); // Filter out empty strings

  if (normalizedSkills.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Skills</h2>
      <div className="flex flex-wrap gap-2">
        {normalizedSkills.map((skill, index) => (
          <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded">
            {skill}
          </span>
        ))}
      </div>
    </section>
  );
}
