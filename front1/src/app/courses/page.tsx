'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Image from 'next/image';

interface Course {
  id: number;
  title: string;
  provider: string;
  duration: string;
  price: string;
  description: string;
  image?: string;
  aiRecommended: boolean;
  rating?: number;
  students?: number;
  skillLevel?: string;
  certificate?: boolean;
  language?: string;
}

export default function CoursesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [skillLevel, setSkillLevel] = useState('all');
  const [provider, setProvider] = useState('all');
  const [price, setPrice] = useState('all');
  const [duration, setDuration] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');

  const courses: Course[] = [
    {
      id: 1,
      title: 'Agile Project Management Fundamentals',
      provider: 'SAASA',
      duration: '4 weeks',
      price: 'Free',
      description: 'Learn the core principles and practices of Agile methodology to efficiently manage projects and deliver value.',
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=200&fit=crop',
      aiRecommended: true,
      rating: 4.7,
      students: 1250,
      skillLevel: 'Beginner',
      certificate: true,
      language: 'English',
    },
    {
      id: 2,
      title: 'Introduction to Data Science with Python',
      provider: 'Udemy',
      duration: '8 weeks',
      price: '$99.99',
      description: 'Master the basics of data science, including Python programming, data manipulation, and analysis techniques.',
      image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=200&fit=crop',
      aiRecommended: true,
      rating: 4.8,
      students: 3200,
      skillLevel: 'Intermediate',
      certificate: true,
      language: 'English',
    },
    {
      id: 3,
      title: 'Effective Communication Strategies',
      provider: 'Coursera',
      duration: '3 weeks',
      price: 'Free',
      description: 'Enhance your verbal and written communication skills for professional success and better team collaboration.',
      image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=200&fit=crop',
      aiRecommended: true,
      rating: 4.6,
      students: 890,
      skillLevel: 'Beginner',
      certificate: true,
      language: 'English',
    },
    {
      id: 4,
      title: 'Effective Leadership and Team Management',
      provider: 'Coursera',
      duration: '6 weeks',
      price: '$199.00',
      description: 'Cultivate essential leadership qualities and learn to motivate, inspire, and manage high-performing teams.',
      image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=400&h=200&fit=crop',
      aiRecommended: true,
      rating: 4.9,
      students: 2100,
      skillLevel: 'Intermediate',
      certificate: true,
      language: 'English',
    },
    {
      id: 5,
      title: 'Cloud Computing Essentials (AWS)',
      provider: 'SAASA',
      duration: '6 weeks',
      price: '$149.00',
      description: 'Gain foundational knowledge of cloud computing, focusing on Amazon Web Services (AWS) infrastructure.',
      image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=200&fit=crop',
      aiRecommended: true,
      rating: 4.8,
      students: 1850,
      skillLevel: 'Intermediate',
      certificate: true,
      language: 'English',
    },
    {
      id: 6,
      title: 'UX/UI Design Principles',
      provider: 'Udemy',
      duration: '5 weeks',
      price: '$79.99',
      description: 'Explore the fundamental principles of User Experience (UX) and User Interface (UI) design for intuitive digital products.',
      image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=200&fit=crop',
      aiRecommended: true,
      rating: 4.7,
      students: 2450,
      skillLevel: 'Beginner',
      certificate: true,
      language: 'English',
    },
    {
      id: 7,
      title: 'Cybersecurity for Beginners',
      provider: 'Coursera',
      duration: '7 weeks',
      price: '$129.00',
      description: 'Understand key cybersecurity concepts, threats, and protective measures to safeguard digital assets and information.',
      image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=200&fit=crop',
      aiRecommended: true,
      rating: 4.6,
      students: 1650,
      skillLevel: 'Beginner',
      certificate: true,
      language: 'English',
    },
    {
      id: 8,
      title: 'Digital Marketing Fundamentals',
      provider: 'SAASA',
      duration: '4 weeks',
      price: 'Free',
      description: 'Learn the essentials of digital marketing, including SEO, social media, and content strategy for online presence.',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=200&fit=crop',
      aiRecommended: true,
      rating: 4.5,
      students: 1100,
      skillLevel: 'Beginner',
      certificate: true,
      language: 'English',
    },
    {
      id: 9,
      title: 'Personal Financial Planning',
      provider: 'Udemy',
      duration: '2 weeks',
      price: '$49.99',
      description: 'Develop strategies for budgeting, saving, investing, and managing debt to achieve financial independence.',
      image: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&h=200&fit=crop',
      aiRecommended: true,
      rating: 4.7,
      students: 980,
      skillLevel: 'Beginner',
      certificate: true,
      language: 'English',
    },
    {
      id: 10,
      title: 'Machine Learning Basics',
      provider: 'Coursera',
      duration: '10 weeks',
      price: '$179.00',
      description: 'Introduction to machine learning algorithms, neural networks, and practical applications in real-world scenarios.',
      image: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400&h=200&fit=crop',
      aiRecommended: true,
      rating: 4.9,
      students: 2800,
      skillLevel: 'Advanced',
      certificate: true,
      language: 'English',
    },
    {
      id: 11,
      title: 'Full Stack Web Development',
      provider: 'SAASA',
      duration: '12 weeks',
      price: '$249.00',
      description: 'Master frontend and backend development with modern frameworks and tools to build complete web applications.',
      image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=200&fit=crop',
      aiRecommended: true,
      rating: 4.8,
      students: 3500,
      skillLevel: 'Intermediate',
      certificate: true,
      language: 'English',
    },
    {
      id: 12,
      title: 'Business Analytics and Data Visualization',
      provider: 'Udemy',
      duration: '6 weeks',
      price: '$89.99',
      description: 'Learn to analyze business data and create compelling visualizations to drive data-driven decision making.',
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=200&fit=crop',
      aiRecommended: true,
      rating: 4.6,
      students: 1400,
      skillLevel: 'Intermediate',
      certificate: true,
      language: 'English',
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #fde9d4, #fafbfb, #bddffb)" }}>
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Title Section */}
        <div className="mb-8">
          <h1
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '36px',
              fontWeight: 700,
              color: '#111827',
              marginBottom: '12px',
              letterSpacing: '-0.5px',
            }}
          >
            Recommended Courses for You
          </h1>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '16px',
              color: '#6B7280',
              lineHeight: '1.6',
              maxWidth: '800px',
            }}
          >
            Based on your CV, job preferences, and feedback. AI has analyzed your profile and recommends these courses to improve your job-fit score.
          </p>
        </div>

        {/* Search and Filter Section */}
        <div className="mb-8 flex flex-col lg:flex-row gap-6">
          {/* Search Bar and Filters Container */}
          <div
            className="p-5 flex flex-col gap-4"
            style={{
              width: '861px',
              height: '187px',
              borderRadius: '14px',
              border: '0 solid #000',
              background: '#FFF',
              boxShadow: '0 0 2px 0 rgba(23, 26, 31, 0.12), 0 0 0 0 rgba(0, 0, 0, 0.00)',
            }}
          >
            {/* Search Input */}
            <div className="relative w-full">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9095A1"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Filters Row */}
            <div className="flex gap-4">
              {/* Skill Level */}
              <div className="flex flex-col gap-1.5 flex-1 relative">
                <label
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  Skill Level
                </label>
                <select
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(e.target.value)}
                  className="w-full px-3 py-2.5 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 appearance-none"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                  }}
                >
                  <option value="all">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-9 flex items-center">
                  <svg className="h-4 w-4 text-[#9095A1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Provider */}
              <div className="flex flex-col gap-1.5 flex-1 relative">
                <label
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2.5 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 appearance-none"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                  }}
                >
                  <option value="all">All Providers</option>
                  <option value="saasa">SAASA</option>
                  <option value="udemy">Udemy</option>
                  <option value="coursera">Coursera</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-9 flex items-center">
                  <svg className="h-4 w-4 text-[#9095A1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Price */}
              <div className="flex flex-col gap-1.5 flex-1 relative">
                <label
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  Price
                </label>
                <select
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2.5 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 appearance-none"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                  }}
                >
                  <option value="all">All</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-9 flex items-center">
                  <svg className="h-4 w-4 text-[#9095A1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Duration */}
              <div className="flex flex-col gap-1.5 flex-1 relative">
                <label
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2.5 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 appearance-none"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                  }}
                >
                  <option value="all">All</option>
                  <option value="short">1-4 weeks</option>
                  <option value="medium">5-8 weeks</option>
                  <option value="long">9+ weeks</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-9 flex items-center">
                  <svg className="h-4 w-4 text-[#9095A1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Sort By */}
              <div className="flex flex-col gap-1.5 flex-1 relative">
                <label
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2.5 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 appearance-none"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                  }}
                >
                  <option value="relevance">Relevance</option>
                  <option value="price">Price</option>
                  <option value="duration">Duration</option>
                  <option value="newest">Newest</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-9 flex items-center">
                  <svg className="h-4 w-4 text-[#9095A1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Why these courses? Section */}
          <div className="lg:w-80 lg:-mt-14">
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h3
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#111827',
                  marginBottom: '16px',
                }}
              >
                Why these courses?
              </h3>
              <ul className="space-y-3" style={{ fontFamily: 'Inter, sans-serif' }}>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.5' }}>
                    Address missing skills identified by your CV.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.5' }}>
                    ATS-based recommendations to pass screening.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1">•</span>
                  <span style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.5' }}>
                    Improve your job-fit score for target roles.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Course Cards Grid */}
        <div className="flex flex-wrap gap-6 mb-8 justify-center lg:justify-start">
          {courses.map((course) => (
            <div
              key={course.id}
              className="overflow-hidden transition-all duration-300 flex flex-col border-2 border-gray-200 hover:border-[#28A8DF] group"
              style={{
                borderRadius: '14px',
                background: '#FFF',
                boxShadow: '0 0 2px 0 rgba(23, 26, 31, 0.12), 0 0 0 0 rgba(0, 0, 0, 0.00)',
                width: '271px',
                height: '524px',
              }}
            >
              {/* Course Image */}
              <div className="w-full h-40 bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {course.image ? (
                  <Image
                    src={course.image}
                    alt={course.title}
                    width={400}
                    height={200}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <svg
                      width="64"
                      height="64"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#9CA3AF"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                  </div>
                )}
              </div>

              {/* Course Content */}
              <div className="px-5 pt-5 pb-5 flex flex-col flex-1" style={{ minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {/* Provider and AI Recommended */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13px',
                      color: '#6B7280',
                      fontWeight: 500,
                    }}
                  >
                    {course.provider}
                  </span>
                  {course.aiRecommended && (
                    <span
                      className="px-2 py-1 rounded-full"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#28A8DF',
                        backgroundColor: '#DBEAFE',
                      }}
                    >
                      AI Recommended
                    </span>
                  )}
                </div>

                {/* Course Title */}
                <h3
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#111827',
                    marginBottom: '8px',
                    lineHeight: '1.3',
                  }}
                >
                  {course.title}
                </h3>

                {/* Duration and Price */}
                <div className="flex items-center gap-4 mb-2">
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13px',
                      color: '#6B7280',
                    }}
                  >
                    {course.duration}
                  </span>
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#111827',
                    }}
                  >
                    {course.price}
                  </span>
                </div>

                {/* Rating and Students */}
                {(course.rating || course.students) && (
                  <div className="flex items-center gap-3 mb-2">
                    {course.rating && (
                      <div className="flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#FBBF24" stroke="none">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <span
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '12px',
                            color: '#111827',
                            fontWeight: 600,
                          }}
                        >
                          {course.rating}
                        </span>
                      </div>
                    )}
                    {course.students && (
                      <span
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '12px',
                          color: '#6B7280',
                        }}
                      >
                        ({course.students.toLocaleString()} students)
                      </span>
                    )}
                  </div>
                )}

                {/* Skill Level and Certificate */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {course.skillLevel && (
                    <span
                      className="px-2 py-0.5 rounded"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: '#059669',
                        backgroundColor: '#D1FAE5',
                      }}
                    >
                      {course.skillLevel}
                    </span>
                  )}
                  {course.certificate && (
                    <span
                      className="px-2 py-0.5 rounded flex items-center gap-1"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: '#7C3AED',
                        backgroundColor: '#EDE9FE',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      Certificate
                    </span>
                  )}
                  {course.language && (
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '11px',
                        color: '#6B7280',
                      }}
                    >
                      • {course.language}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: '#6B7280',
                    lineHeight: '1.5',
                    marginBottom: '12px',
                    maxHeight: '63px',
                    overflow: 'hidden',
                  }}
                >
                  {course.description}
                </p>

                {/* View Details Button */}
                <button
                  onClick={() => router.push(`/courses/${course.id}`)}
                  className="w-full px-4 py-2.5 rounded-lg font-medium transition-colors"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    backgroundColor: '#FC9620',
                    color: '#FFFFFF',
                    marginTop: 'auto',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#EA580C';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FC9620';
                  }}
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Explore All Courses Button */}
        <div className="flex justify-center mb-8">
          <button
            className="px-8 py-3 rounded-lg font-medium border-2 transition-colors"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '15px',
              color: '#28A8DF',
              borderColor: '#28A8DF',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#EFF6FF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Explore All Courses
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
