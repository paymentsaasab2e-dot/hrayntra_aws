interface Education {
  degree: string;
  institution: string;
  start_year: string;
  end_year: string;
  specialization?: string;
  grade?: string;
}

interface ResumeEducationProps {
  educations: Education[];
}

export default function ResumeEducation({ educations }: ResumeEducationProps) {
  if (!educations || educations.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Education</h2>
      {educations.map((edu, index) => (
        <div key={index} className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">{edu.degree}</h3>
          <p className="text-sm text-gray-600">{edu.institution}</p>
          {edu.specialization && (
            <p className="text-sm text-gray-500">{edu.specialization}</p>
          )}
          <p className="text-sm text-gray-500">{edu.start_year} - {edu.end_year}</p>
          {edu.grade && (
            <p className="text-sm text-gray-500">Grade: {edu.grade}</p>
          )}
        </div>
      ))}
    </section>
  );
}
