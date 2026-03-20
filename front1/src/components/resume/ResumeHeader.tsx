interface ResumeHeaderProps {
  name: string;
  title: string;
}

export default function ResumeHeader({ name, title }: ResumeHeaderProps) {
  return (
    <div className="text-center mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{name.toUpperCase()}</h1>
      <p className="text-xl text-gray-600">{title}</p>
    </div>
  );
}
