'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import Image from 'next/image';

interface Course {
  id: number;
  title: string;
  provider: string;
  duration: string;
  price: string;
  originalPrice?: string;
  description: string;
  longDescription: string;
  image?: string;
  aiRecommended: boolean;
  instructor: {
    name: string;
    title: string;
    bio: string;
    image?: string;
  };
  modules: {
    id: number;
    title: string;
    description: string;
  }[];
  learningObjectives: string[];
  reviews: {
    id: number;
    name: string;
    rating: number;
    comment: string;
    image?: string;
  }[];
  rating: number;
  reviewCount: number;
}

export default function CourseDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params?.id as string;
  const [expandedModule, setExpandedModule] = useState<number | null>(1);

  // Sample course data - in a real app, this would be fetched based on courseId
  const course: Course = {
    id: 1,
    title: 'Advanced AI for Job Seekers: Mastering Prompt Engineering & Interview Prep',
    provider: 'SAASA',
    duration: '12 Weeks',
    price: '$299',
    originalPrice: '$499',
    description: 'Master the basics of data science, including Python programming, data manipulation, and analysis techniques.',
    longDescription: `In today's competitive job market, leveraging artificial intelligence can give you a significant edge. This comprehensive course is designed specifically for job seekers who want to harness the power of AI to enhance their career prospects.

You'll learn how to use AI tools to optimize your resume and cover letters, making them more appealing to both human recruiters and Applicant Tracking Systems (ATS). The course covers advanced prompt engineering techniques that will help you get better results from AI models like ChatGPT, Claude, and others.

Beyond document optimization, you'll discover how to use AI for interview preparation. Learn to simulate job interviews, receive personalized feedback, and practice answering common interview questions with AI-powered coaching.

The course also covers AI-driven networking strategies and market analysis, helping you identify the best opportunities and tailor your applications accordingly. By the end of this course, you'll have built a complete AI-enhanced job search workflow that can significantly improve your job-fit score and increase your chances of landing your dream job.`,
    aiRecommended: true,
    instructor: {
      name: 'Dr. Evelyn Reed',
      title: 'AI Strategy & Career Development',
      bio: `Dr. Evelyn Reed is a renowned expert in AI strategy and career development with over 15 years of experience in the tech industry. She has helped thousands of professionals advance their careers through innovative AI-powered tools and techniques. Dr. Reed holds a Ph.D. in Computer Science from MIT and has worked with leading tech companies including Google, Microsoft, and Amazon. She is also a certified career coach and has published numerous research papers on AI applications in human resources and career development.`,
      image: '/cv_main.jpg',
    },
    modules: [
      {
        id: 1,
        title: 'Foundations of AI for Job Search',
        description: 'Introduction to AI tools and their applications in job searching. Learn the basics of prompt engineering and how to interact effectively with AI models.',
      },
      {
        id: 2,
        title: 'AI-Powered Resume & Cover Letter Optimization',
        description: 'Master techniques for optimizing your resume and cover letters using AI. Learn to pass ATS screening and make your documents stand out to recruiters.',
      },
      {
        id: 3,
        title: 'Advanced Interview Preparation with AI',
        description: 'Use AI to simulate job interviews, practice responses, and receive personalized feedback. Learn to prepare for different types of interview questions.',
      },
      {
        id: 4,
        title: 'Networking & Market Analysis with AI',
        description: 'Discover how to use AI for networking strategies and market analysis. Learn to identify opportunities and tailor your applications effectively.',
      },
      {
        id: 5,
        title: 'Project: Building Your AI-Enhanced Job Search Workflow',
        description: "Apply everything you've learned to build a complete AI-enhanced job search workflow. Create a personalized system that improves your job-fit score.",
      },
    ],
    learningObjectives: [
      'Master prompt engineering techniques for various AI models',
      'Optimize resumes and cover letters to pass ATS screening',
      'Simulate job interviews using AI for personalized feedback',
      'Leverage AI for networking and market analysis',
      'Build a complete AI-enhanced job search workflow',
    ],
    reviews: [
      {
        id: 1,
        name: 'Sarah Johnson',
        rating: 5,
        comment: 'This course completely transformed my job search. The AI techniques I learned helped me land three interviews in just two weeks!',
        image: '/cv_main.jpg',
      },
      {
        id: 2,
        name: 'Michael Chen',
        rating: 5,
        comment: 'Excellent course! The prompt engineering section was particularly valuable. Highly recommend for anyone serious about their career.',
        image: '/cv_main.jpg',
      },
      {
        id: 3,
        name: 'Emily Rodriguez',
        rating: 5,
        comment: 'Dr. Reed is an amazing instructor. The interview prep module alone was worth the entire course fee. My confidence has skyrocketed!',
        image: '/cv_main.jpg',
      },
      {
        id: 4,
        name: 'David Kim',
        rating: 4,
        comment: 'Great content and practical exercises. The AI tools covered are cutting-edge and really work. Would love to see more advanced modules.',
        image: '/cv_main.jpg',
      },
    ],
    rating: 4.8,
    reviewCount: 245,
  };

  const relatedCourses = [
    {
      id: 2,
      title: 'Machine Learning Fundamentals for Career Growth',
      instructor: 'Prof. James Wilson',
      rating: 4.7,
      price: '$199',
      image: '/cv_main.jpg',
    },
    {
      id: 3,
      title: 'Data Analytics for Business Professionals',
      instructor: 'Dr. Maria Garcia',
      rating: 4.9,
      price: '$249',
      image: '/cv_main.jpg',
    },
    {
      id: 4,
      title: 'Digital Marketing Strategy & Implementation',
      instructor: 'Alex Thompson',
      rating: 4.6,
      price: '$179',
      image: '/cv_main.jpg',
    },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(210deg, rgba(255, 171, 98, 0.40) 1.61%, #FFF 32.61%, rgba(40, 168, 223, 0.25) 87.92%), #FFF',
      }}
    >
      <Header />

      <main className="mx-auto max-w-7xl px-8 py-10">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Courses
        </button>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Left Column - Main Content */}
          <div className="flex-1 max-w-4xl">
            {/* Course Title */}
            <div className="mb-6">
              <h1
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '36px',
                  fontWeight: 700,
                  color: '#111827',
                  marginBottom: '12px',
                  lineHeight: '1.2',
                  letterSpacing: '-0.5px',
                }}
              >
                {course.title}
              </h1>
              <div className="flex items-center gap-3">
                {course.aiRecommended && (
                  <span
                    className="px-3 py-1 rounded-full"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#28A8DF',
                      backgroundColor: '#DBEAFE',
                    }}
                  >
                    AI Recommended
                  </span>
                )}
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: '#6B7280',
                  }}
                >
                  {course.provider} • {course.duration}
                </span>
              </div>
            </div>

            {/* Video Player */}
            <div className="mb-8 relative bg-gray-900 rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: '16/9' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-black/20"></div>
                  <button
                    className="relative w-24 h-24 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center hover:bg-white hover:scale-110 transition-all duration-300 shadow-2xl z-10"
                    onClick={() => {
                      // Handle video play
                    }}
                  >
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="#28A8DF"
                      className="ml-1"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/20">
                HD
              </div>
            </div>

            {/* What You Will Learn */}
            <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50">
              <h2
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '28px',
                  fontWeight: 700,
                  color: '#111827',
                  marginBottom: '24px',
                  letterSpacing: '-0.3px',
                }}
              >
                What You Will Learn
              </h2>
              <ul className="space-y-4">
                {course.learningObjectives.map((objective, index) => (
                  <li key={index} className="flex items-start gap-4 p-3 rounded-xl hover:bg-blue-50/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '16px',
                        color: '#374151',
                        lineHeight: '1.7',
                        fontWeight: 500,
                      }}
                    >
                      {objective}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Course Description */}
            <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50">
              <h2
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '28px',
                  fontWeight: 700,
                  color: '#111827',
                  marginBottom: '20px',
                  letterSpacing: '-0.3px',
                }}
              >
                Course Description
              </h2>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '16px',
                  color: '#4B5563',
                  lineHeight: '1.8',
                  whiteSpace: 'pre-line',
                }}
              >
                {course.longDescription}
              </p>
            </div>

            {/* Course Syllabus */}
            <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50">
              <h2
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '28px',
                  fontWeight: 700,
                  color: '#111827',
                  marginBottom: '24px',
                  letterSpacing: '-0.3px',
                }}
              >
                Course Syllabus
              </h2>
              <div className="space-y-3">
                {course.modules.map((module) => (
                  <div
                    key={module.id}
                    className="border border-gray-200 rounded-xl overflow-hidden bg-white/50 hover:border-blue-300 transition-all duration-200"
                  >
                    <button
                      onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-blue-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '14px',
                              fontWeight: 700,
                              color: '#28A8DF',
                            }}
                          >
                            {module.id}
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#111827',
                          }}
                        >
                          {module.title}
                        </span>
                      </div>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#6B7280"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-transform duration-200 ${expandedModule === module.id ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    {expandedModule === module.id && (
                      <div className="px-5 pb-5 pt-2 bg-blue-50/30">
                        <p
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '15px',
                            color: '#4B5563',
                            lineHeight: '1.7',
                          }}
                        >
                          {module.description}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* About Your Instructor */}
            <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50">
              <h2
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '28px',
                  fontWeight: 700,
                  color: '#111827',
                  marginBottom: '24px',
                  letterSpacing: '-0.3px',
                }}
              >
                About Your Instructor
              </h2>
              <div className="flex gap-6">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md border-2 border-white">
                  {course.instructor.image ? (
                    <Image
                      src={course.instructor.image}
                      alt={course.instructor.name}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#9CA3AF"
                      strokeWidth="2"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '20px',
                      fontWeight: 700,
                      color: '#111827',
                      marginBottom: '6px',
                    }}
                  >
                    {course.instructor.name}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '15px',
                      color: '#6B7280',
                      marginBottom: '16px',
                      fontWeight: 500,
                    }}
                  >
                    {course.instructor.title}
                  </p>
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '15px',
                      color: '#4B5563',
                      lineHeight: '1.7',
                    }}
                  >
                    {course.instructor.bio}
                  </p>
                </div>
              </div>
            </div>

            {/* Student Reviews */}
            <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50">
              <div className="flex items-center gap-4 mb-8">
                <h2
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '28px',
                    fontWeight: 700,
                    color: '#111827',
                    letterSpacing: '-0.3px',
                  }}
                >
                  Student Reviews
                </h2>
                <div className="flex items-center gap-3 px-4 py-2 bg-yellow-50 rounded-xl border border-yellow-200">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="#FBBF24"
                        stroke="#FBBF24"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#111827',
                    }}
                  >
                    {course.rating} ({course.reviewCount} reviews)
                  </span>
                </div>
              </div>
              <div className="space-y-5">
                {course.reviews.map((review) => (
                  <div key={review.id} className="flex gap-4 p-4 rounded-xl bg-gray-50/50 hover:bg-gray-100/50 transition-colors">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md border-2 border-white">
                      {review.image ? (
                        <Image
                          src={review.image}
                          alt={review.name}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#9CA3AF"
                          strokeWidth="2"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '17px',
                            fontWeight: 600,
                            color: '#111827',
                          }}
                        >
                          {review.name}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill={i < review.rating ? '#FBBF24' : '#E5E7EB'}
                            >
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      <p
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '15px',
                          color: '#4B5563',
                          lineHeight: '1.7',
                        }}
                      >
                        {review.comment}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Enroll Now Button */}
            <button
              onClick={() => {
                // Handle enrollment
              }}
              className="w-full py-5 rounded-2xl font-bold text-white transition-all duration-300 mb-8 shadow-xl hover:shadow-2xl hover:scale-[1.02]"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '17px',
                background: 'linear-gradient(135deg, #28A8DF 0%, #2563EB 100%)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #28A8DF 0%, #2563EB 100%)';
              }}
            >
              Enroll Now & Improve Your Job Fit Score
            </button>
          </div>

          {/* Right Sidebar */}
          <div className="lg:w-80 flex-shrink-0">
            {/* Pricing Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 mb-6 border border-blue-200 shadow-lg">
              <div className="mb-4">
                <div className="flex items-baseline gap-2 mb-2">
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '36px',
                      fontWeight: 700,
                      color: '#111827',
                    }}
                  >
                    {course.price}
                  </span>
                  {course.originalPrice && (
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '20px',
                        fontWeight: 400,
                        color: '#6B7280',
                        textDecoration: 'line-through',
                      }}
                    >
                      {course.originalPrice}
                    </span>
                  )}
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#374151' }}>
                      {course.duration}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#374151' }}>
                      Self-Paced Online
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#374151' }}>
                      On-Demand
                    </span>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#6B7280' }}>
                      Progress
                    </span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#6B7280' }}>
                      75%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: '75%' }}
                    ></div>
                  </div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                    75% of students finish in 3 months
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  // Handle enrollment
                }}
                className="w-full py-3.5 rounded-xl font-bold text-white mb-3 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '15px',
                  background: 'linear-gradient(135deg, #28A8DF 0%, #2563EB 100%)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #28A8DF 0%, #2563EB 100%)';
                }}
              >
                Enroll Now
              </button>
              <button
                className="w-full text-center text-blue-600 hover:text-blue-700 transition-colors"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Apply Coupon Code
              </button>
            </div>

            {/* Certificate Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-200 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0 shadow-md">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#28A8DF" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '15px',
                    color: '#374151',
                    lineHeight: '1.6',
                    fontWeight: 500,
                  }}
                >
                  Earn a SAASA recognized Certificate of Completion upon finishing this course.
                </p>
              </div>
            </div>

            {/* Course Suggestions */}
            <div>
              <h3
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#111827',
                  marginBottom: '20px',
                  letterSpacing: '-0.3px',
                }}
              >
                Course Suggestions
              </h3>
              <div className="space-y-4">
                {relatedCourses.map((relatedCourse) => (
                  <div
                    key={relatedCourse.id}
                    className="bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-200 shadow-lg cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                    onClick={() => router.push(`/courses/${relatedCourse.id}`)}
                  >
                    <div className="w-full h-36 bg-gradient-to-br from-purple-200 via-blue-200 to-indigo-200 flex items-center justify-center">
                      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.5">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                      </svg>
                    </div>
                    <div className="p-5">
                      <h4
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '16px',
                          fontWeight: 600,
                          color: '#111827',
                          marginBottom: '8px',
                          lineHeight: '1.4',
                        }}
                      >
                        {relatedCourse.title}
                      </h4>
                      <p
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '14px',
                          color: '#6B7280',
                          marginBottom: '12px',
                        }}
                      >
                        {relatedCourse.instructor}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#FBBF24">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#374151', fontWeight: 500 }}>
                            {relatedCourse.rating}
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '16px',
                            fontWeight: 700,
                            color: '#111827',
                          }}
                        >
                          {relatedCourse.price}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
