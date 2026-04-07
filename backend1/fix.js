const fs = require('fs');
const file = 'prisma/schema.prisma';
let schema = fs.readFileSync(file, 'utf8');

const relations = `
  lmsEnrollments         LmsEnrollment[]         @relation("LmsEnrollments")
  lmsQuizAttempts        LmsQuizAttempt[]        @relation("LmsQuizAttempts")
  lmsNotes               LmsNote[]               @relation("LmsNotes")
  lmsEventRegistrations  LmsEventRegistration[]  @relation("LmsEventRegistrations")
  lmsResumeDraft         LmsResumeDraft?         @relation("LmsResumeDraft")
  lmsCareerPath          LmsCareerPath?          @relation("LmsCareerPath")
  lmsInterviewSessions   LmsInterviewPrepSession[] @relation("LmsInterviewSessions")
  lmsInterviewSets       LmsInterviewSet[]       @relation("LmsInterviewSets")
`;

if (!schema.includes('lmsEnrollments')) {
  // Try to inject at the end of the Candidate model
  schema = schema.replace('courseEnrollments  CourseEnrollment[]', 'courseEnrollments  CourseEnrollment[]\n' + relations);
  // Also try replacing courseEnrollments CourseEnrollment[] 
  schema = schema.replace('courseEnrollments CourseEnrollment[]', 'courseEnrollments CourseEnrollment[]\n' + relations);
  
  if (!schema.includes('lmsEnrollments')) {
    // If not replaced, inject before @@map("candidates")
    schema = schema.replace('@@map("candidates")', relations + '\n  @@map("candidates")');
  }

  fs.writeFileSync(file, schema);
  console.log('Successfully injected Candidate relations.');
} else {
  console.log('Candidate relations already present.');
}
