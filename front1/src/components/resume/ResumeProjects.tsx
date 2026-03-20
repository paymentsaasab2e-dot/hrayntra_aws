interface Project {
  title: string;
  description: string;
  link?: string;
  technologies?: string[];
}

interface ResumeProjectsProps {
  projects: Project[];
}

export default function ResumeProjects({ projects }: ResumeProjectsProps) {
  if (!projects || projects.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Projects</h2>
      {projects.map((project, index) => (
        <div key={index} className="mb-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-base font-semibold text-gray-900">{project.title}</h3>
            {project.link && (
              <a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                View Project
              </a>
            )}
          </div>
          {project.description && (
            <p className="text-sm text-gray-700 leading-relaxed mb-2">{project.description}</p>
          )}
          {project.technologies && project.technologies.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.technologies.map((tech, techIndex) => (
                <span key={techIndex} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                  {tech}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
