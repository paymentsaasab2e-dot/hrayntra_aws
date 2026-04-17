import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';

export const hqService = {
  async setupSuperAdmin(data) {
    const { name, email, userId, password } = data; // userId is used as loginId
    
    if (!name || !email || !userId || !password) {
      throw new Error('All fields (name, email, userId, password) are required');
    }

    // 1. Find or Create Super Admin system role to mirror enum role
    let superAdminRole = await prisma.systemRole.findUnique({
      where: { roleName: 'Super Admin' }
    });

    if (!superAdminRole) {
      console.log('⚠️ Super Admin system role not found by name "Super Admin", checking by "SUPER_ADMIN"');
      superAdminRole = await prisma.systemRole.findFirst({
        where: { roleName: { contains: 'Admin', mode: 'insensitive' } }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // 2. Upsert User
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role: 'SUPER_ADMIN',
        roleId: superAdminRole?.id,
        isActive: true,
        passwordHash: hashedPassword, // Backward compatibility
      },
      create: {
        name,
        email,
        role: 'SUPER_ADMIN',
        roleId: superAdminRole?.id,
        isActive: true,
        passwordHash: hashedPassword,
      },
    });

    // 3. Upsert UserCredential
    await prisma.userCredential.upsert({
      where: { userId: user.id },
      update: {
        loginId: userId,
        hashedPassword,
        tempPasswordFlag: false,
        isLocked: false,
        failedAttempts: 0,
      },
      create: {
        userId: user.id,
        loginId: userId,
        hashedPassword,
        tempPasswordFlag: false,
        isLocked: false,
        failedAttempts: 0,
      },
    });

    return { 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        loginId: userId,
        role: 'SUPER_ADMIN'
      } 
    };
  }
};
