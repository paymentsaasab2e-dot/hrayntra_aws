export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: {
    name: string;
    logo?: string;
  };
  designation: string;
  type: 'HR' | 'Hiring Manager' | 'Interviewer' | 'Vendor' | 'Partner';
  associatedJobs: number;
  owner: string;
  lastContacted: string;
  status: 'Active' | 'Inactive';
  avatar: string;
  tags: string[];
}

export const MOCK_CONTACTS: Contact[] = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    email: 'sarah.j@techflow.io',
    phone: '+1 (555) 123-4567',
    company: { name: 'TechFlow' },
    designation: 'Head of Talent',
    type: 'HR',
    associatedJobs: 4,
    owner: 'Alex Rivera',
    lastContacted: '2 days ago',
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1738566061505-556830f8b8f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdCUyMGZhY2UlMjBvZmZpY2V8ZW58MXx8fHwxNzcwNzE0OTU0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['VIP', 'Key Client'],
  },
  {
    id: '2',
    name: 'Marcus Chen',
    email: 'm.chen@nova-ventures.com',
    phone: '+1 (555) 987-6543',
    company: { name: 'Nova Ventures' },
    designation: 'Engineering Manager',
    type: 'Hiring Manager',
    associatedJobs: 2,
    owner: 'Alex Rivera',
    lastContacted: '5 hours ago',
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1758518727984-17b37f2f0562?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3Jwb3JhdGUlMjBvZmZpY2V8ZW58MXx8fHwxNzcwNjMwNTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['Interview Panel'],
  },
  {
    id: '3',
    name: 'Elena Rodriguez',
    email: 'elena@skyline-solutions.com',
    phone: '+1 (555) 456-7890',
    company: { name: 'Skyline Solutions' },
    designation: 'Senior Architect',
    type: 'Interviewer',
    associatedJobs: 1,
    owner: 'Jordan Smith',
    lastContacted: '1 week ago',
    status: 'Inactive',
    avatar: 'https://images.unsplash.com/photo-1758518729459-235dcaadc611?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWlsaW5nJTIwcHJvZmVzc2lvbmFsJTIwd29tYW4lMjBvZmZpY2V8ZW58MXx8fHwxNzcwNTk1NzA1fDA&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['Technical Expert'],
  },
  {
    id: '4',
    name: 'David Wilson',
    email: 'david@global-staffing.net',
    phone: '+1 (555) 222-3333',
    company: { name: 'Global Staffing' },
    designation: 'Account Director',
    type: 'Vendor',
    associatedJobs: 8,
    owner: 'Alex Rivera',
    lastContacted: '3 days ago',
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400',
    tags: ['Partner'],
  },
  {
    id: '5',
    name: 'Jessica Lee',
    email: 'j.lee@pulse-media.com',
    phone: '+1 (555) 777-8888',
    company: { name: 'Pulse Media' },
    designation: 'Talent Acquisition',
    type: 'HR',
    associatedJobs: 3,
    owner: 'Jordan Smith',
    lastContacted: 'Yesterday',
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
    tags: [],
  }
];
