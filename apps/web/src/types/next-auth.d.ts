import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      globalRole: 'USER' | 'SUPER_ADMIN';
      hasStaffAccess: boolean;
      hasStudentAccess: boolean;
    };
  }

  interface User {
    id: string;
    globalRole: 'USER' | 'SUPER_ADMIN';
    hasStaffAccess: boolean;
    hasStudentAccess: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    globalRole?: 'USER' | 'SUPER_ADMIN';
    hasStaffAccess?: boolean;
    hasStudentAccess?: boolean;
  }
}
