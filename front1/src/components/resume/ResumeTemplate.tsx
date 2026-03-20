import ResumeHeader from './ResumeHeader';
import ResumeSummary from './ResumeSummary';
import ResumeExperience from './ResumeExperience';
import ResumeEducation from './ResumeEducation';
import ResumeSkills from './ResumeSkills';
import ResumeProjects from './ResumeProjects';
import ResumeCertifications from './ResumeCertifications';
import ResumeCustomSections from './ResumeCustomSections';

export interface ResumeJSON {
  name: string;
  title: string;
  summary: string;
  experience: Array<{
    role: string;
    company: string;
    start_date: string;
    end_date: string;
    description: string;
    location?: string;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    start_year: string;
    end_year: string;
    specialization?: string;
    grade?: string;
  }>;
  skills: string[];
  projects: Array<{
    title: string;
    description: string;
    link?: string;
    technologies?: string[];
  }>;
  certifications: Array<{
    name: string;
    organization: string;
    issue_date: string;
    expiry_date?: string;
    credential_id?: string;
    credential_url?: string;
  }>;
  custom_sections: Array<{
    title: string;
    items: Array<{
      title?: string;
      description?: string;
      date?: string;
      [key: string]: any;
    }>;
  }>;
}

interface ResumeTemplateProps {
  resume: ResumeJSON;
}

export default function ResumeTemplate({ resume }: ResumeTemplateProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-8 max-w-4xl mx-auto">
      <ResumeHeader name={resume.name || ''} title={resume.title || ''} />
      <ResumeSummary summary={resume.summary || ''} />
      <ResumeExperience experiences={resume.experience || []} />
      <ResumeEducation educations={resume.education || []} />
      <ResumeSkills skills={resume.skills || []} />
      <ResumeProjects projects={resume.projects || []} />
      <ResumeCertifications certifications={resume.certifications || []} />
      <ResumeCustomSections customSections={resume.custom_sections || []} />
    </div>
  );
}
