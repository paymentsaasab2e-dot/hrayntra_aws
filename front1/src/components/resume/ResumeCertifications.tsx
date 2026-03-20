interface Certification {
  name: string;
  organization: string;
  issue_date: string;
  expiry_date?: string;
  credential_id?: string;
  credential_url?: string;
}

interface ResumeCertificationsProps {
  certifications: Certification[];
}

export default function ResumeCertifications({ certifications }: ResumeCertificationsProps) {
  if (!certifications || certifications.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Certifications</h2>
      {certifications.map((cert, index) => (
        <div key={index} className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">{cert.name}</h3>
          <p className="text-sm text-gray-600">{cert.organization}</p>
          <p className="text-sm text-gray-500">
            Issued: {cert.issue_date}
            {cert.expiry_date && ` | Expires: ${cert.expiry_date}`}
          </p>
          {cert.credential_id && (
            <p className="text-sm text-gray-500">Credential ID: {cert.credential_id}</p>
          )}
          {cert.credential_url && (
            <a
              href={cert.credential_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              Verify Credential
            </a>
          )}
        </div>
      ))}
    </section>
  );
}
