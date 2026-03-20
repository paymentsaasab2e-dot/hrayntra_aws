interface Experience {
  role: string;
  company: string;
  start_date: string;
  end_date: string;
  description: string;
  location?: string;
}

interface ResumeExperienceProps {
  experiences: Experience[];
}

export default function ResumeExperience({ experiences }: ResumeExperienceProps) {
  if (!experiences || experiences.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Experience</h2>
      {experiences.map((exp, index) => (
        <div key={index} className="mb-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{exp.role}</h3>
              <p className="text-sm text-gray-600">{exp.company}</p>
            </div>
            <span className="text-sm text-gray-500">
              {exp.start_date} - {exp.end_date}
            </span>
          </div>
          {exp.description && (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{exp.description}</p>
          )}
        </div>
      ))}
    </section>
  );
}
