import { prisma } from '../../config/prisma.js';
import { encryption } from '../../utils/encryption.js';
import { env } from '../../config/env.js';

export const linkedinService = {
  async getTokenByUserId(userId) {
    // Check if linkedInToken model exists (Prisma uses camelCase: LinkedInToken -> linkedInToken)
    if (!prisma.linkedInToken) {
      console.warn('LinkedInToken model not found in Prisma Client. Please restart the server after running prisma generate.');
      return null;
    }

    const tokenRecord = await prisma.linkedInToken.findUnique({
      where: { userId },
    });

    if (!tokenRecord) return null;

    // Check if token is expired
    if (new Date(tokenRecord.expiresAt) < new Date()) {
      return { ...tokenRecord, expired: true };
    }

    // Decrypt access token
    try {
      const decryptedToken = encryption.decryptToken(tokenRecord.accessToken);
      return {
        ...tokenRecord,
        accessToken: decryptedToken,
        expired: false,
      };
    } catch (error) {
      console.error('Failed to decrypt LinkedIn token:', error);
      return { ...tokenRecord, expired: true };
    }
  },

  async saveToken(userId, linkedinSub, accessToken, expiresIn, name, picture, email = null) {
    // Check if linkedInToken model exists (Prisma uses camelCase: LinkedInToken -> linkedInToken)
    if (!prisma.linkedInToken) {
      throw new Error('LinkedInToken model not found. Please restart the server after running prisma generate.');
    }

    // Encrypt access token before storing
    const encryptedToken = encryption.encryptToken(accessToken);
    
    // Calculate expiration date (expiresIn is in seconds, typically 5184000 for 60 days)
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return prisma.linkedInToken.upsert({
      where: { userId },
      update: {
        linkedinSub,
        accessToken: encryptedToken,
        expiresAt,
        name,
        picture,
        ...(email !== undefined ? { email } : {}),
        updatedAt: new Date(),
      },
      create: {
        userId,
        linkedinSub,
        accessToken: encryptedToken,
        expiresAt,
        name,
        picture,
        email: email ?? null,
      },
    });
  },

  async deleteToken(userId) {
    if (!prisma.linkedInToken) {
      throw new Error('LinkedInToken model not found. Please restart the server after running prisma generate.');
    }

    await prisma.linkedInToken.delete({
      where: { userId },
    });
    return { message: 'LinkedIn connection disconnected' };
  },

  async getStatus(userId) {
    const token = await this.getTokenByUserId(userId);
    
    if (!token) {
      return { connected: false };
    }

    if (token.expired) {
      return { connected: false, expired: true };
    }

    return {
      connected: true,
      name: token.name,
      picture: token.picture,
    };
  },

  async postJob(userId, jobData) {
    const tokenRecord = await this.getTokenByUserId(userId);

    if (!tokenRecord) {
      throw new Error('LinkedIn not connected');
    }

    if (tokenRecord.expired) {
      throw new Error('LinkedIn token expired. Please reconnect.');
    }

    const { accessToken, linkedinSub } = tokenRecord;

    // Use provided postText or generate default
    const shareText = jobData.postText || `We're hiring a ${jobData.jobTitle} at ${jobData.company}!\n\n${jobData.description?.substring(0, 200) || ''}${jobData.description?.length > 200 ? '...' : ''}\n\n${jobData.location ? `Location: ${jobData.location}\n\n` : ''}Apply here: ${jobData.applyUrl}\n\n#hiring #jobs #careers`;

    const ugcPostPayload = {
      author: `urn:li:person:${linkedinSub}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: shareText,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    // Post to LinkedIn API
    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(ugcPostPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LinkedIn API error:', errorText);
      
      if (response.status === 401) {
        throw new Error('LinkedIn token expired. Please reconnect.');
      }
      
      if (response.status === 429) {
        throw new Error('LinkedIn rate limit reached. Try again in 15 minutes.');
      }

      throw new Error(`LinkedIn API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const postId = result.id?.replace('urn:li:ugcPost:', '') || '';
    const linkedinPostUrl = postId ? `https://www.linkedin.com/feed/update/${postId}` : 'https://www.linkedin.com/feed/';

    return {
      success: true,
      linkedinPostUrl,
      postId,
    };
  },
};
