/**
 * Shared demo seed for student & lecturer flows.
 *
 * One source of truth for courses → weeks → assignments → submissions → results.
 * Covers every status in the assignment lifecycle so demos never look empty.
 *
 * Status lifecycle:
 *   OPEN              → student can submit (deadline > now)
 *   SUBMITTED         → student submitted, deadline not yet reached
 *   CLOSED            → deadline passed, student did not submit
 *   WAITING_FOR_REVIEW→ deadline passed, AI grading queued but not started
 *   PROCESSING        → AI grading is running
 *   READY_FOR_REVIEW  → AI graded, lecturer review pending (lecturer side)
 *   PUBLISHED         → lecturer published, student can see grade & feedback
 */

export type AssignmentStatus =
  | 'OPEN'
  | 'SUBMITTED'
  | 'CLOSED'
  | 'WAITING_FOR_REVIEW'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'PUBLISHED';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

export interface DemoCourse {
  id: string;
  title: string;
  code: string;
  lecturer: string;
  semester: string;
  description: string;
  studentCount: number;
}

export interface DemoWeek {
  id: string;
  courseId: string;
  number: number;
  title: string;
  topic: string;
  summary: string;
  resources: { label: string; type: 'lecture' | 'reading' | 'video' }[];
}

export interface DemoQuestion {
  id: number;
  title: string;
  maxPoints: number;
  prompt?: string;
}

export interface DemoDeduction {
  reason: string;
  points: number;
  severity: 'critical' | 'major' | 'minor';
}

export interface DemoQuestionResult {
  id: number;
  title: string;
  maxPoints: number;
  earnedPoints: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  deductions: DemoDeduction[];
}

export interface DemoAssignment {
  id: string;
  courseId: string;
  weekId: string;
  weekNumber: number;
  title: string;
  shortTitle: string;
  description: string;
  status: AssignmentStatus;
  releasedAt: string;
  deadline: string;
  maxScore: number;
  questions: DemoQuestion[];
  submittedAt?: string;
  submissionFileName?: string;
  submissionPages?: number;
  /** ISO timestamp when AI grading queue accepted the submission. */
  queuedAt?: string;
  /** Progress (0-1) for PROCESSING. */
  processingProgress?: number;
  /** Estimated minutes remaining for PROCESSING. */
  processingEtaMinutes?: number;
  /** AI-suggested score, available once status reaches READY_FOR_REVIEW. */
  aiSuggestedScore?: number;
  /** Lecturer-confirmed final score, set when PUBLISHED. */
  finalScore?: number;
  publishedAt?: string;
  /** Per-question AI/lecturer grading; present from READY_FOR_REVIEW onwards. */
  results?: DemoQuestionResult[];
  overallFeedback?: string;
  overallStrengths?: string[];
  overallImprovements?: string[];
  recommendations?: { topic: string; description: string; link: string }[];
}

export interface DemoStudent {
  id: string;
  name: string;
  email: string;
  enrolledCourseIds: string[];
}

/* ─────────────────────────────────────────────
   Constants — anchor today at the system date
   ───────────────────────────────────────────── */

const TODAY = '2026-04-16';

function isoDaysFrom(base: string, days: number, hour = 23, minute = 59): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

/* ─────────────────────────────────────────────
   Persona
   ───────────────────────────────────────────── */

export const DEMO_STUDENT: DemoStudent = {
  id: 'student-001',
  name: 'Liam Esika',
  email: 'liam.esika@univ.edu',
  enrolledCourseIds: ['c1', 'c2', 'c3', 'c4'],
};

/* ─────────────────────────────────────────────
   Courses
   ───────────────────────────────────────────── */

export const DEMO_COURSES: DemoCourse[] = [
  {
    id: 'c1',
    title: 'Linear Algebra',
    code: 'MATH 2210',
    lecturer: 'Prof. Cohen',
    semester: 'Spring 2026',
    description: 'Vectors, matrices, eigenvalues, inner-product spaces, and the SVD with applications to data and graphics.',
    studentCount: 48,
  },
  {
    id: 'c2',
    title: 'Calculus II',
    code: 'MATH 1220',
    lecturer: 'Dr. Levi',
    semester: 'Spring 2026',
    description: 'Sequences, series, integration techniques, Taylor expansions, and an introduction to differential equations.',
    studentCount: 62,
  },
  {
    id: 'c3',
    title: 'Introduction to Physics',
    code: 'PHYS 1010',
    lecturer: 'Prof. Mizrahi',
    semester: 'Spring 2026',
    description: 'Classical mechanics: kinematics, Newtonian dynamics, energy, momentum, and rotational motion.',
    studentCount: 71,
  },
  {
    id: 'c4',
    title: 'Discrete Mathematics',
    code: 'CS 1100',
    lecturer: 'Dr. Avraham',
    semester: 'Spring 2026',
    description: 'Logic, sets, combinatorics, graph theory, and proof techniques for computer science.',
    studentCount: 54,
  },
];

/* ─────────────────────────────────────────────
   Weeks  (6 per course, week 6 is the current week)
   ───────────────────────────────────────────── */

export const DEMO_WEEKS: DemoWeek[] = [
  // Linear Algebra (c1)
  { id: 'c1-w1', courseId: 'c1', number: 1, title: 'Vectors and Vector Spaces', topic: 'Foundations', summary: 'Vector arithmetic, span, linear independence, and subspaces in ℝⁿ.', resources: [{ label: 'Lecture 1 — Vectors', type: 'lecture' }, { label: 'Strang Ch. 1', type: 'reading' }] },
  { id: 'c1-w2', courseId: 'c1', number: 2, title: 'Matrices and Linear Systems', topic: 'Systems', summary: 'Gaussian elimination, row reduction, and the structure of solution sets.', resources: [{ label: 'Lecture 2 — Elimination', type: 'lecture' }, { label: 'Worked examples', type: 'video' }] },
  { id: 'c1-w3', courseId: 'c1', number: 3, title: 'Determinants', topic: 'Algebraic invariants', summary: 'Cofactor expansion, properties of determinants, Cramer\u2019s rule.', resources: [{ label: 'Lecture 3 — Determinants', type: 'lecture' }] },
  { id: 'c1-w4', courseId: 'c1', number: 4, title: 'Eigenvalues and Eigenvectors', topic: 'Spectral theory', summary: 'Characteristic polynomial, eigenspaces, diagonalization.', resources: [{ label: 'Lecture 4 — Eigenvalues', type: 'lecture' }, { label: '3Blue1Brown — Eigenvectors', type: 'video' }] },
  { id: 'c1-w5', courseId: 'c1', number: 5, title: 'Inner Product Spaces', topic: 'Geometry', summary: 'Orthogonality, projections, Gram-Schmidt, least squares.', resources: [{ label: 'Lecture 5 — Inner products', type: 'lecture' }] },
  { id: 'c1-w6', courseId: 'c1', number: 6, title: 'Singular Value Decomposition', topic: 'Decompositions', summary: 'SVD, low-rank approximation, PCA and applications.', resources: [{ label: 'Lecture 6 — SVD', type: 'lecture' }, { label: 'PCA primer', type: 'reading' }] },

  // Calculus II (c2)
  { id: 'c2-w1', courseId: 'c2', number: 1, title: 'Review of Limits and Continuity', topic: 'Foundations', summary: 'Limit laws, continuity, indeterminate forms, L\u2019H\u00f4pital.', resources: [{ label: 'Lecture 1 — Limits', type: 'lecture' }] },
  { id: 'c2-w2', courseId: 'c2', number: 2, title: 'Sequences', topic: 'Sequences and series', summary: 'Bounded and monotone sequences, limits at infinity.', resources: [{ label: 'Lecture 2 — Sequences', type: 'lecture' }] },
  { id: 'c2-w3', courseId: 'c2', number: 3, title: 'Series and Convergence', topic: 'Sequences and series', summary: 'Convergence tests: comparison, ratio, root, integral.', resources: [{ label: 'Lecture 3 — Series', type: 'lecture' }] },
  { id: 'c2-w4', courseId: 'c2', number: 4, title: 'Integration Techniques', topic: 'Integration', summary: 'Integration by parts, partial fractions, trigonometric substitution.', resources: [{ label: 'Lecture 4 — Integration', type: 'lecture' }] },
  { id: 'c2-w5', courseId: 'c2', number: 5, title: 'Taylor Series', topic: 'Approximation', summary: 'Taylor and Maclaurin series, error bounds.', resources: [{ label: 'Lecture 5 — Taylor', type: 'lecture' }] },
  { id: 'c2-w6', courseId: 'c2', number: 6, title: 'Differential Equations', topic: 'Applications', summary: 'First-order ODEs, separable equations, modeling.', resources: [{ label: 'Lecture 6 — ODEs', type: 'lecture' }] },

  // Physics (c3)
  { id: 'c3-w1', courseId: 'c3', number: 1, title: 'Kinematics in 1D', topic: 'Motion', summary: 'Position, velocity, acceleration, kinematic equations.', resources: [{ label: 'Lecture 1', type: 'lecture' }] },
  { id: 'c3-w2', courseId: 'c3', number: 2, title: 'Kinematics in 2D', topic: 'Motion', summary: 'Vectors, projectile motion, relative velocity.', resources: [{ label: 'Lecture 2', type: 'lecture' }] },
  { id: 'c3-w3', courseId: 'c3', number: 3, title: 'Newton\u2019s Laws', topic: 'Dynamics', summary: 'Forces, free-body diagrams, friction, tension.', resources: [{ label: 'Lecture 3', type: 'lecture' }] },
  { id: 'c3-w4', courseId: 'c3', number: 4, title: 'Work and Energy', topic: 'Energy', summary: 'Work-energy theorem, conservative forces, potential energy.', resources: [{ label: 'Lecture 4', type: 'lecture' }] },
  { id: 'c3-w5', courseId: 'c3', number: 5, title: 'Momentum and Collisions', topic: 'Conservation', summary: 'Impulse, conservation of momentum, elastic and inelastic collisions.', resources: [{ label: 'Lecture 5', type: 'lecture' }] },
  { id: 'c3-w6', courseId: 'c3', number: 6, title: 'Rotational Motion', topic: 'Rotation', summary: 'Angular kinematics, torque, moment of inertia.', resources: [{ label: 'Lecture 6', type: 'lecture' }] },

  // Discrete Math (c4)
  { id: 'c4-w1', courseId: 'c4', number: 1, title: 'Propositional Logic', topic: 'Logic', summary: 'Connectives, truth tables, logical equivalence.', resources: [{ label: 'Lecture 1', type: 'lecture' }] },
  { id: 'c4-w2', courseId: 'c4', number: 2, title: 'Predicates and Quantifiers', topic: 'Logic', summary: 'Universal and existential quantifiers, nested quantifiers.', resources: [{ label: 'Lecture 2', type: 'lecture' }] },
  { id: 'c4-w3', courseId: 'c4', number: 3, title: 'Sets and Functions', topic: 'Foundations', summary: 'Set operations, functions, cardinality.', resources: [{ label: 'Lecture 3', type: 'lecture' }] },
  { id: 'c4-w4', courseId: 'c4', number: 4, title: 'Induction', topic: 'Proof techniques', summary: 'Mathematical and strong induction.', resources: [{ label: 'Lecture 4', type: 'lecture' }] },
  { id: 'c4-w5', courseId: 'c4', number: 5, title: 'Counting', topic: 'Combinatorics', summary: 'Permutations, combinations, pigeonhole principle.', resources: [{ label: 'Lecture 5', type: 'lecture' }] },
  { id: 'c4-w6', courseId: 'c4', number: 6, title: 'Graphs', topic: 'Graph theory', summary: 'Graph terminology, paths, trees, connectivity.', resources: [{ label: 'Lecture 6', type: 'lecture' }] },
];

/* ─────────────────────────────────────────────
   Standard question banks (reused per assignment)
   ───────────────────────────────────────────── */

const QB_GENERIC_4: DemoQuestion[] = [
  { id: 1, title: 'Conceptual definitions', maxPoints: 20 },
  { id: 2, title: 'Proofs from definitions', maxPoints: 25 },
  { id: 3, title: 'Computation', maxPoints: 25 },
  { id: 4, title: 'Application', maxPoints: 30 },
];

const QB_CALC_HW2: DemoQuestion[] = [
  { id: 1, title: 'Definitions of sequence convergence', maxPoints: 16 },
  { id: 2, title: 'Convergence proofs from definitions', maxPoints: 20 },
  { id: 3, title: 'Limit at infinity & l\u2019H\u00f4pital application', maxPoints: 16 },
  { id: 4, title: 'Limit as a function of a parameter', maxPoints: 12 },
  { id: 5, title: 'Recursive sequences and convergence', maxPoints: 18 },
  { id: 6, title: 'Two coupled recursive sequences', maxPoints: 18 },
];

/* ─────────────────────────────────────────────
   Assignments
   ───────────────────────────────────────────── */

export const DEMO_ASSIGNMENTS: DemoAssignment[] = [
  /* ── Linear Algebra ── */
  {
    id: 'c1-w1-a1',
    courseId: 'c1',
    weekId: 'c1-w1',
    weekNumber: 1,
    title: 'Vector Operations and Span',
    shortTitle: 'Vectors HW',
    description: 'Practice vector arithmetic, dot products, and reasoning about spans in ℝ\u00b3.',
    status: 'PUBLISHED',
    releasedAt: isoDaysFrom(TODAY, -56),
    deadline: isoDaysFrom(TODAY, -49),
    maxScore: 100,
    questions: QB_GENERIC_4,
    submittedAt: isoDaysFrom(TODAY, -50, 18, 22),
    submissionFileName: 'la_hw1_liam.pdf',
    submissionPages: 6,
    aiSuggestedScore: 86,
    finalScore: 88,
    publishedAt: isoDaysFrom(TODAY, -47, 9, 0),
    overallFeedback: 'Strong opening homework. Vector arithmetic is solid and your reasoning about span is clear. Watch out for sign errors in dot products and remember to justify linear independence with explicit equations.',
    overallStrengths: ['Clear notation throughout', 'Correct geometric interpretation of span'],
    overallImprovements: ['Justify linear independence with the defining linear combination', 'Recheck arithmetic on signed dot products'],
    recommendations: [
      { topic: 'Vectors and span', description: 'Re-watch lecture 1 to nail the definition of span before moving on.', link: '#lecture-1' },
    ],
    results: [
      { id: 1, title: 'Conceptual definitions', maxPoints: 20, earnedPoints: 18, feedback: 'Clear definition of span; minor wording on linear independence.', strengths: ['Concise wording'], improvements: ['Tighten the wording around linear independence'], deductions: [{ reason: 'Definition of independence missing the "implies all coefficients zero" closure', points: 2, severity: 'minor' }] },
      { id: 2, title: 'Proofs from definitions', maxPoints: 25, earnedPoints: 22, feedback: 'Both proofs are correct in structure.', strengths: ['Logical flow'], improvements: ['State the contrapositive explicitly when used'], deductions: [{ reason: 'Implicit case left unjustified in proof 2', points: 3, severity: 'minor' }] },
      { id: 3, title: 'Computation', maxPoints: 25, earnedPoints: 23, feedback: 'Computations are accurate aside from a single sign slip.', strengths: ['Step-by-step work shown'], improvements: ['Double-check sign of dot product'], deductions: [{ reason: 'Sign error in dot product (3·(-2) written as +6)', points: 2, severity: 'minor' }] },
      { id: 4, title: 'Application', maxPoints: 30, earnedPoints: 25, feedback: 'Application is mostly right; missed one edge case.', strengths: ['Geometric reasoning is on point'], improvements: ['Cover the trivial case explicitly'], deductions: [{ reason: 'Missed the trivial subspace case', points: 5, severity: 'major' }] },
    ],
  },
  {
    id: 'c1-w2-a1',
    courseId: 'c1',
    weekId: 'c1-w2',
    weekNumber: 2,
    title: 'Gaussian Elimination',
    shortTitle: 'Elimination HW',
    description: 'Solve linear systems using row reduction and identify free vs. basic variables.',
    status: 'PUBLISHED',
    releasedAt: isoDaysFrom(TODAY, -49),
    deadline: isoDaysFrom(TODAY, -42),
    maxScore: 100,
    questions: QB_GENERIC_4,
    submittedAt: isoDaysFrom(TODAY, -43, 21, 5),
    submissionFileName: 'la_hw2_liam.pdf',
    submissionPages: 7,
    aiSuggestedScore: 91,
    finalScore: 92,
    publishedAt: isoDaysFrom(TODAY, -40, 9, 0),
    overallFeedback: 'Excellent work on row reduction. Free variables are correctly identified and parameterized.',
    overallStrengths: ['Clean row operations', 'Correct parameterization of solutions'],
    overallImprovements: ['Add a brief justification when swapping rows'],
    results: [
      { id: 1, title: 'Conceptual definitions', maxPoints: 20, earnedPoints: 19, feedback: 'Definitions are accurate.', strengths: ['Crisp definitions'], improvements: [], deductions: [{ reason: 'Minor wording on echelon form', points: 1, severity: 'minor' }] },
      { id: 2, title: 'Proofs from definitions', maxPoints: 25, earnedPoints: 22, feedback: 'Solid proofs.', strengths: ['Logical flow'], improvements: ['Reference the relevant theorem'], deductions: [{ reason: 'Skipped a small step', points: 3, severity: 'minor' }] },
      { id: 3, title: 'Computation', maxPoints: 25, earnedPoints: 25, feedback: 'Perfect computation.', strengths: ['No errors'], improvements: [], deductions: [] },
      { id: 4, title: 'Application', maxPoints: 30, earnedPoints: 26, feedback: 'Strong application; minor algebra slip near the end.', strengths: ['Right setup'], improvements: ['Recheck arithmetic'], deductions: [{ reason: 'Final algebra simplification', points: 4, severity: 'minor' }] },
    ],
  },
  {
    id: 'c1-w3-a1',
    courseId: 'c1',
    weekId: 'c1-w3',
    weekNumber: 3,
    title: 'Determinants and Cofactor Expansion',
    shortTitle: 'Determinants HW',
    description: 'Compute determinants by row reduction and cofactor expansion; explore properties.',
    status: 'PUBLISHED',
    releasedAt: isoDaysFrom(TODAY, -42),
    deadline: isoDaysFrom(TODAY, -35),
    maxScore: 100,
    questions: QB_GENERIC_4,
    submittedAt: isoDaysFrom(TODAY, -36, 22, 30),
    submissionFileName: 'la_hw3_liam.pdf',
    submissionPages: 5,
    aiSuggestedScore: 84,
    finalScore: 85,
    publishedAt: isoDaysFrom(TODAY, -33, 9, 0),
    overallFeedback: 'Good understanding of determinants. Watch the alternating sign pattern in cofactor expansion.',
    overallStrengths: ['Clear cofactor setup'],
    overallImprovements: ['Sign tracking', 'Verify by row reduction'],
    results: [
      { id: 1, title: 'Conceptual definitions', maxPoints: 20, earnedPoints: 17, feedback: 'Mostly correct.', strengths: ['Right idea'], improvements: ['Clarify cofactor sign'], deductions: [{ reason: 'Sign rule omitted', points: 3, severity: 'minor' }] },
      { id: 2, title: 'Proofs from definitions', maxPoints: 25, earnedPoints: 22, feedback: 'Good proofs.', strengths: ['Clear flow'], improvements: [], deductions: [{ reason: 'Missing case', points: 3, severity: 'minor' }] },
      { id: 3, title: 'Computation', maxPoints: 25, earnedPoints: 22, feedback: 'Sign errors crept in.', strengths: [], improvements: ['Check signs'], deductions: [{ reason: 'Sign error in final expansion', points: 3, severity: 'major' }] },
      { id: 4, title: 'Application', maxPoints: 30, earnedPoints: 24, feedback: 'Good application.', strengths: ['Logical'], improvements: [], deductions: [{ reason: 'Skipped verification', points: 6, severity: 'major' }] },
    ],
  },
  {
    id: 'c1-w4-a1',
    courseId: 'c1',
    weekId: 'c1-w4',
    weekNumber: 4,
    title: 'Finding Eigenvalues',
    shortTitle: 'Eigenvalues HW',
    description: 'Compute characteristic polynomials and eigenvalues for 2×2 and 3×3 matrices.',
    status: 'PUBLISHED',
    releasedAt: isoDaysFrom(TODAY, -35),
    deadline: isoDaysFrom(TODAY, -28),
    maxScore: 100,
    questions: QB_GENERIC_4,
    submittedAt: isoDaysFrom(TODAY, -29, 23, 12),
    submissionFileName: 'la_hw4_liam.pdf',
    submissionPages: 6,
    aiSuggestedScore: 70,
    finalScore: 70,
    publishedAt: isoDaysFrom(TODAY, -26, 9, 0),
    overallFeedback: 'Setup of the characteristic polynomial was correct, but quadratic-formula errors propagated through the eigenvector calculations. Spend time on accurate algebra.',
    overallStrengths: ['Right setup of det(A − λI) = 0'],
    overallImprovements: ['Verify each eigenvalue by substitution', 'Take care with the quadratic formula'],
    recommendations: [
      { topic: 'Eigenvalue computation', description: 'Practice characteristic polynomial setup and quadratic-formula precision.', link: '#lecture-4' },
    ],
    results: [
      { id: 1, title: 'Conceptual definitions', maxPoints: 20, earnedPoints: 16, feedback: 'Definitions partially correct.', strengths: [], improvements: ['Review definitions'], deductions: [{ reason: 'Missing definition of eigenspace', points: 4, severity: 'minor' }] },
      { id: 2, title: 'Proofs from definitions', maxPoints: 25, earnedPoints: 18, feedback: 'Some logical gaps.', strengths: [], improvements: ['Tighten proofs'], deductions: [{ reason: 'Step skipped in proof', points: 7, severity: 'major' }] },
      { id: 3, title: 'Computation', maxPoints: 25, earnedPoints: 18, feedback: 'Errors in quadratic formula.', strengths: [], improvements: ['Recompute carefully'], deductions: [{ reason: 'Quadratic formula error in eigenvalue', points: 4, severity: 'critical' }, { reason: 'Eigenvector wrong as a result', points: 3, severity: 'major' }] },
      { id: 4, title: 'Application', maxPoints: 30, earnedPoints: 18, feedback: 'Application affected by earlier errors.', strengths: [], improvements: ['Fix root cause first'], deductions: [{ reason: 'Propagated computation error', points: 12, severity: 'major' }] },
    ],
  },
  {
    id: 'c1-w5-a1',
    courseId: 'c1',
    weekId: 'c1-w5',
    weekNumber: 5,
    title: 'Orthogonality and Projections',
    shortTitle: 'Projections HW',
    description: 'Gram-Schmidt orthogonalization, projections, and least-squares fits.',
    status: 'WAITING_FOR_REVIEW',
    releasedAt: isoDaysFrom(TODAY, -21),
    deadline: isoDaysFrom(TODAY, -3),
    maxScore: 100,
    questions: QB_GENERIC_4,
    submittedAt: isoDaysFrom(TODAY, -3, 21, 47),
    submissionFileName: 'la_hw5_liam.pdf',
    submissionPages: 8,
    queuedAt: isoDaysFrom(TODAY, -2, 9, 0),
  },
  {
    id: 'c1-w6-a1',
    courseId: 'c1',
    weekId: 'c1-w6',
    weekNumber: 6,
    title: 'SVD Applications',
    shortTitle: 'SVD HW',
    description: 'Compute reduced SVDs, low-rank approximations, and apply to image compression.',
    status: 'OPEN',
    releasedAt: isoDaysFrom(TODAY, -2),
    deadline: isoDaysFrom(TODAY, 5),
    maxScore: 100,
    questions: QB_GENERIC_4,
  },

  /* ── Calculus II ── */
  {
    id: 'c2-w1-a1',
    courseId: 'c2',
    weekId: 'c2-w1',
    weekNumber: 1,
    title: 'Limits and Continuity Review',
    shortTitle: 'Limits HW',
    description: 'Practice limit computation, continuity arguments, and l\u2019H\u00f4pital\u2019s rule.',
    status: 'PUBLISHED',
    releasedAt: isoDaysFrom(TODAY, -56),
    deadline: isoDaysFrom(TODAY, -49),
    maxScore: 100,
    questions: QB_GENERIC_4,
    submittedAt: isoDaysFrom(TODAY, -50, 19, 30),
    submissionFileName: 'calc2_hw1_liam.pdf',
    submissionPages: 5,
    aiSuggestedScore: 88,
    finalScore: 90,
    publishedAt: isoDaysFrom(TODAY, -47, 9, 0),
    overallFeedback: 'Excellent review homework. Limit computations are precise and continuity arguments are well structured.',
    overallStrengths: ['Crisp limit notation', 'Correct application of l\u2019H\u00f4pital'],
    overallImprovements: ['State the indeterminate form before applying l\u2019H\u00f4pital'],
    results: [
      { id: 1, title: 'Conceptual definitions', maxPoints: 20, earnedPoints: 18, feedback: 'Strong.', strengths: ['Concise'], improvements: [], deductions: [{ reason: 'Wording', points: 2, severity: 'minor' }] },
      { id: 2, title: 'Proofs from definitions', maxPoints: 25, earnedPoints: 22, feedback: 'Solid.', strengths: ['Clear'], improvements: [], deductions: [{ reason: 'Minor gap', points: 3, severity: 'minor' }] },
      { id: 3, title: 'Computation', maxPoints: 25, earnedPoints: 24, feedback: 'Essentially perfect.', strengths: ['Accurate'], improvements: [], deductions: [{ reason: 'Notation', points: 1, severity: 'minor' }] },
      { id: 4, title: 'Application', maxPoints: 30, earnedPoints: 26, feedback: 'Great applications.', strengths: ['Right approach'], improvements: [], deductions: [{ reason: 'Edge case', points: 4, severity: 'minor' }] },
    ],
  },
  {
    id: 'c2-w2-a1',
    courseId: 'c2',
    weekId: 'c2-w2',
    weekNumber: 2,
    title: 'Homework 2 — Sequences',
    shortTitle: 'Sequences HW',
    description: 'Definitions of convergence, proofs, recursive sequences and limits.',
    status: 'READY_FOR_REVIEW',
    releasedAt: isoDaysFrom(TODAY, -28),
    deadline: isoDaysFrom(TODAY, -7),
    maxScore: 100,
    questions: QB_CALC_HW2,
    submittedAt: isoDaysFrom(TODAY, -7, 22, 15),
    submissionFileName: 'calc2_hw2_liam.pdf',
    submissionPages: 9,
    queuedAt: isoDaysFrom(TODAY, -6, 9, 0),
    aiSuggestedScore: 78,
    overallFeedback: 'Good attempt across all six questions. Definitions are largely right but proofs sometimes skip the explicit ε-N step. Recursive sequence work is on the right track but the convergence argument needs the squeeze theorem.',
    overallStrengths: ['All six questions attempted', 'Recursive setups are correct'],
    overallImprovements: ['Make ε-N steps explicit', 'Cite the monotone-bounded convergence theorem by name'],
    recommendations: [
      { topic: 'ε-N proofs', description: 'Re-watch lecture 2 on the formal definition of a limit.', link: '#lecture-2' },
      { topic: 'Monotone convergence', description: 'Review the proof template for monotone-bounded sequences.', link: '#lecture-2b' },
    ],
    results: [
      { id: 1, title: 'Definitions of sequence convergence', maxPoints: 16, earnedPoints: 14, feedback: 'Definitions correct; one is missing a quantifier.', strengths: ['No negation words used'], improvements: ['Add the universal quantifier in (b)'], deductions: [{ reason: 'Missing ∀ in definition (b)', points: 2, severity: 'minor' }] },
      { id: 2, title: 'Convergence proofs from definitions', maxPoints: 20, earnedPoints: 14, feedback: 'Right structure but ε-N step is implicit.', strengths: ['Right idea'], improvements: ['Make ε-N explicit'], deductions: [{ reason: 'ε not chosen explicitly in proof of (a)', points: 3, severity: 'major' }, { reason: 'Hint not used in (c)', points: 3, severity: 'minor' }] },
      { id: 3, title: 'Limit at infinity & l\u2019H\u00f4pital application', maxPoints: 16, earnedPoints: 13, feedback: 'Computation OK with one slip.', strengths: ['Right rewrite'], improvements: ['Recheck algebra'], deductions: [{ reason: 'Sign error in expansion', points: 3, severity: 'major' }] },
      { id: 4, title: 'Limit as a function of a parameter', maxPoints: 12, earnedPoints: 10, feedback: 'Almost right; missed boundary.', strengths: [], improvements: ['Check α → 0 boundary'], deductions: [{ reason: 'Boundary case missing', points: 2, severity: 'minor' }] },
      { id: 5, title: 'Recursive sequences and convergence', maxPoints: 18, earnedPoints: 14, feedback: 'Setup correct; convergence argument incomplete.', strengths: ['Recursion derived'], improvements: ['Cite monotone-bounded theorem'], deductions: [{ reason: 'Convergence step skipped', points: 4, severity: 'major' }] },
      { id: 6, title: 'Two coupled recursive sequences', maxPoints: 18, earnedPoints: 13, feedback: 'Almost there; algebra error in invariant.', strengths: ['Right idea'], improvements: ['Verify invariant by induction'], deductions: [{ reason: 'Invariant aₙbₙ = a₁b₁ not properly justified', points: 5, severity: 'major' }] },
    ],
  },
  {
    id: 'c2-w3-a1',
    courseId: 'c2',
    weekId: 'c2-w3',
    weekNumber: 3,
    title: 'Series Convergence Tests',
    shortTitle: 'Series HW',
    description: 'Apply ratio, root, integral, and comparison tests to a variety of series.',
    status: 'PROCESSING',
    releasedAt: isoDaysFrom(TODAY, -14),
    deadline: isoDaysFrom(TODAY, -1),
    maxScore: 100,
    questions: QB_GENERIC_4,
    submittedAt: isoDaysFrom(TODAY, -1, 22, 50),
    submissionFileName: 'calc2_hw3_liam.pdf',
    submissionPages: 7,
    queuedAt: isoDaysFrom(TODAY, 0, 6, 30),
    processingProgress: 0.62,
    processingEtaMinutes: 8,
  },
  {
    id: 'c2-w4-a1',
    courseId: 'c2',
    weekId: 'c2-w4',
    weekNumber: 4,
    title: 'Integration Techniques',
    shortTitle: 'Integration HW',
    description: 'Integration by parts, partial fractions, and trig substitution.',
    status: 'SUBMITTED',
    releasedAt: isoDaysFrom(TODAY, -7),
    deadline: isoDaysFrom(TODAY, 2),
    maxScore: 100,
    questions: QB_GENERIC_4,
    submittedAt: isoDaysFrom(TODAY, -1, 19, 12),
    submissionFileName: 'calc2_hw4_liam_draft.pdf',
    submissionPages: 4,
  },
  {
    id: 'c2-w5-a1',
    courseId: 'c2',
    weekId: 'c2-w5',
    weekNumber: 5,
    title: 'Taylor Series',
    shortTitle: 'Taylor HW',
    description: 'Compute Taylor series, error bounds, and apply to standard functions.',
    status: 'OPEN',
    releasedAt: isoDaysFrom(TODAY, -2),
    deadline: isoDaysFrom(TODAY, 6),
    maxScore: 100,
    questions: QB_GENERIC_4,
  },

  /* ── Physics ── */
  {
    id: 'c3-w3-a1',
    courseId: 'c3',
    weekId: 'c3-w3',
    weekNumber: 3,
    title: "Newton's Laws Practice",
    shortTitle: 'Newton HW',
    description: 'Force diagrams, friction, tension, and inclined planes.',
    status: 'PUBLISHED',
    releasedAt: isoDaysFrom(TODAY, -42),
    deadline: isoDaysFrom(TODAY, -35),
    maxScore: 100,
    questions: QB_GENERIC_4,
    submittedAt: isoDaysFrom(TODAY, -36, 22, 0),
    submissionFileName: 'phys_hw3_liam.pdf',
    submissionPages: 5,
    aiSuggestedScore: 76,
    finalScore: 78,
    publishedAt: isoDaysFrom(TODAY, -33, 9, 0),
    overallFeedback: 'Solid free-body diagrams. Be careful applying friction direction conventions.',
    overallStrengths: ['Clear FBDs'],
    overallImprovements: ['Friction sign convention'],
    results: [
      { id: 1, title: 'Conceptual definitions', maxPoints: 20, earnedPoints: 17, feedback: '', strengths: [], improvements: [], deductions: [{ reason: 'Slight wording', points: 3, severity: 'minor' }] },
      { id: 2, title: 'Proofs from definitions', maxPoints: 25, earnedPoints: 18, feedback: '', strengths: [], improvements: [], deductions: [{ reason: 'Friction sign error', points: 7, severity: 'major' }] },
      { id: 3, title: 'Computation', maxPoints: 25, earnedPoints: 19, feedback: '', strengths: [], improvements: [], deductions: [{ reason: 'Algebra slip', points: 6, severity: 'major' }] },
      { id: 4, title: 'Application', maxPoints: 30, earnedPoints: 22, feedback: '', strengths: [], improvements: [], deductions: [{ reason: 'Edge case missed', points: 8, severity: 'major' }] },
    ],
  },
  {
    id: 'c3-w4-a1',
    courseId: 'c3',
    weekId: 'c3-w4',
    weekNumber: 4,
    title: 'Work and Energy',
    shortTitle: 'Energy HW',
    description: 'Work-energy theorem and conservation of mechanical energy problems.',
    status: 'CLOSED',
    releasedAt: isoDaysFrom(TODAY, -28),
    deadline: isoDaysFrom(TODAY, -10),
    maxScore: 100,
    questions: QB_GENERIC_4,
  },
  {
    id: 'c3-w6-a1',
    courseId: 'c3',
    weekId: 'c3-w6',
    weekNumber: 6,
    title: 'Rotational Motion',
    shortTitle: 'Rotation HW',
    description: 'Angular kinematics, torque, and moment of inertia.',
    status: 'OPEN',
    releasedAt: isoDaysFrom(TODAY, -1),
    deadline: isoDaysFrom(TODAY, 7),
    maxScore: 100,
    questions: QB_GENERIC_4,
  },

  /* ── Discrete Math ── */
  {
    id: 'c4-w4-a1',
    courseId: 'c4',
    weekId: 'c4-w4',
    weekNumber: 4,
    title: 'Induction Proofs',
    shortTitle: 'Induction HW',
    description: 'Prove identities and inequalities by mathematical induction.',
    status: 'PUBLISHED',
    releasedAt: isoDaysFrom(TODAY, -28),
    deadline: isoDaysFrom(TODAY, -21),
    maxScore: 100,
    questions: QB_GENERIC_4,
    submittedAt: isoDaysFrom(TODAY, -22, 23, 1),
    submissionFileName: 'discrete_hw4_liam.pdf',
    submissionPages: 4,
    aiSuggestedScore: 94,
    finalScore: 95,
    publishedAt: isoDaysFrom(TODAY, -19, 9, 0),
    overallFeedback: 'Outstanding induction work. Base cases stated clearly and inductive steps are tight.',
    overallStrengths: ['Clean induction templates', 'Crisp algebra'],
    overallImprovements: ['State strong induction explicitly when used'],
    results: [
      { id: 1, title: 'Conceptual definitions', maxPoints: 20, earnedPoints: 19, feedback: '', strengths: [], improvements: [], deductions: [{ reason: 'Phrasing', points: 1, severity: 'minor' }] },
      { id: 2, title: 'Proofs from definitions', maxPoints: 25, earnedPoints: 24, feedback: '', strengths: [], improvements: [], deductions: [{ reason: 'Tiny gap', points: 1, severity: 'minor' }] },
      { id: 3, title: 'Computation', maxPoints: 25, earnedPoints: 24, feedback: '', strengths: [], improvements: [], deductions: [{ reason: 'Notation', points: 1, severity: 'minor' }] },
      { id: 4, title: 'Application', maxPoints: 30, earnedPoints: 28, feedback: '', strengths: [], improvements: [], deductions: [{ reason: 'Minor edge case', points: 2, severity: 'minor' }] },
    ],
  },
  {
    id: 'c4-w5-a1',
    courseId: 'c4',
    weekId: 'c4-w5',
    weekNumber: 5,
    title: 'Counting and the Pigeonhole Principle',
    shortTitle: 'Counting HW',
    description: 'Apply combinatorial counting and pigeonhole arguments.',
    status: 'OPEN',
    releasedAt: isoDaysFrom(TODAY, -3),
    deadline: isoDaysFrom(TODAY, 4),
    maxScore: 100,
    questions: QB_GENERIC_4,
  },
];

/* ─────────────────────────────────────────────
   Selectors
   ───────────────────────────────────────────── */

export function getCourse(courseId: string): DemoCourse | undefined {
  return DEMO_COURSES.find((c) => c.id === courseId);
}

export function getCourseOrFallback(courseId: string): DemoCourse {
  return getCourse(courseId) ?? DEMO_COURSES[0];
}

export function getWeeksForCourse(courseId: string): DemoWeek[] {
  return DEMO_WEEKS.filter((w) => w.courseId === courseId).sort((a, b) => a.number - b.number);
}

export function getWeek(weekId: string): DemoWeek | undefined {
  return DEMO_WEEKS.find((w) => w.id === weekId);
}

export function getAssignmentsForCourse(courseId: string): DemoAssignment[] {
  return DEMO_ASSIGNMENTS
    .filter((a) => a.courseId === courseId)
    .sort((a, b) => a.weekNumber - b.weekNumber || a.title.localeCompare(b.title));
}

export function getAssignmentsForWeek(weekId: string): DemoAssignment[] {
  return DEMO_ASSIGNMENTS.filter((a) => a.weekId === weekId);
}

export function getAssignment(id: string): DemoAssignment | undefined {
  return DEMO_ASSIGNMENTS.find((a) => a.id === id);
}

export function getAllAssignments(): DemoAssignment[] {
  return [...DEMO_ASSIGNMENTS];
}

export function getPublishedAssignments(): DemoAssignment[] {
  return DEMO_ASSIGNMENTS.filter((a) => a.status === 'PUBLISHED');
}

/** Aggregate per-course progress for a student. */
export function getCourseProgress(courseId: string) {
  const all = getAssignmentsForCourse(courseId);
  const published = all.filter((a) => a.status === 'PUBLISHED');
  const submitted = all.filter((a) => a.status !== 'OPEN' && a.status !== 'CLOSED');
  const grades = published
    .map((a) => (a.finalScore != null ? (a.finalScore / a.maxScore) * 100 : null))
    .filter((g): g is number => g != null);
  const avg = grades.length ? grades.reduce((s, g) => s + g, 0) / grades.length : 0;
  return {
    total: all.length,
    submitted: submitted.length,
    published: published.length,
    averageGrade: Math.round(avg),
    grades,
  };
}

/** Aggregate progress across all enrolled courses. */
export function getOverallProgress() {
  const all = getAllAssignments();
  const published = all.filter((a) => a.status === 'PUBLISHED');
  const open = all.filter((a) => a.status === 'OPEN');
  const submitted = all.filter((a) => a.status === 'SUBMITTED');
  const inGrading = all.filter(
    (a) => a.status === 'WAITING_FOR_REVIEW' || a.status === 'PROCESSING' || a.status === 'READY_FOR_REVIEW',
  );

  const grades = published
    .map((a) => (a.finalScore != null ? (a.finalScore / a.maxScore) * 100 : null))
    .filter((g): g is number => g != null);
  const avg = grades.length ? grades.reduce((s, g) => s + g, 0) / grades.length : 0;
  const best = grades.length ? Math.max(...grades) : 0;

  return {
    total: all.length,
    open: open.length,
    submitted: submitted.length,
    inGrading: inGrading.length,
    published: published.length,
    averageGrade: Math.round(avg),
    bestGrade: Math.round(best),
  };
}

/* ─────────────────────────────────────────────
   Status formatting
   ───────────────────────────────────────────── */

export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  OPEN: 'Open',
  SUBMITTED: 'Submitted',
  CLOSED: 'Closed',
  WAITING_FOR_REVIEW: 'Waiting for review',
  PROCESSING: 'AI grading',
  READY_FOR_REVIEW: 'Ready for review',
  PUBLISHED: 'Published',
};

export const STATUS_DESCRIPTION: Record<AssignmentStatus, string> = {
  OPEN: 'Open for submission until the deadline.',
  SUBMITTED: 'Submitted. You can still replace before the deadline.',
  CLOSED: 'Deadline passed without a submission.',
  WAITING_FOR_REVIEW: 'Submission received. Queued for AI grading.',
  PROCESSING: 'AI is grading your submission right now.',
  READY_FOR_REVIEW: 'Lecturer is reviewing the AI-suggested grade.',
  PUBLISHED: 'Final grade and feedback are available.',
};

/** Map a domain status into the visual StatusBadge tone vocabulary. */
export function statusBadgeTone(status: AssignmentStatus): string {
  switch (status) {
    case 'OPEN':
      return 'active';
    case 'SUBMITTED':
      return 'pending';
    case 'CLOSED':
      return 'locked';
    case 'WAITING_FOR_REVIEW':
      return 'pending';
    case 'PROCESSING':
      return 'pending';
    case 'READY_FOR_REVIEW':
      return 'active';
    case 'PUBLISHED':
      return 'done';
  }
}

/** True when the student can submit/replace a PDF for this assignment. */
export function isSubmissionAllowed(status: AssignmentStatus): boolean {
  return status === 'OPEN' || status === 'SUBMITTED';
}

/** True when the student should see graded feedback. */
export function isResultVisible(status: AssignmentStatus): boolean {
  return status === 'PUBLISHED';
}

/** Where the row should link for a student given its status. */
export function studentAssignmentHref(localePrefix: string, a: DemoAssignment): string | null {
  if (a.status === 'PUBLISHED') {
    return `${localePrefix}/s/courses/${a.courseId}/assignments/${a.id}/result`;
  }
  if (a.status === 'CLOSED') {
    return `${localePrefix}/s/courses/${a.courseId}/assignments/${a.id}`;
  }
  return `${localePrefix}/s/courses/${a.courseId}/assignments/${a.id}`;
}

export const TODAY_ISO = TODAY;
