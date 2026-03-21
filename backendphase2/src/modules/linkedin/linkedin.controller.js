import { sendResponse, sendError } from '../../utils/response.js';
import { linkedinService } from './linkedin.service.js';
import { env } from '../../config/env.js';
import crypto from 'crypto';

export const linkedinController = {
  async initiateAuth(req, res) {
    try {
      if (!req.user) {
        return sendError(res, 401, 'Authentication required');
      }

      // Generate state for CSRF protection
      const state = crypto.randomBytes(32).toString('hex');
      
      // Build auth URL - userId will be passed via state param
      const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', env.LINKEDIN_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', env.LINKEDIN_REDIRECT_URI);
      authUrl.searchParams.set('scope', 'openid profile email w_member_social');
      // Encode userId in state for callback
      const stateWithUserId = `${state}:${req.user.id}`;
      authUrl.searchParams.set('state', stateWithUserId);

      // Log OAuth initiation to terminal
      console.log('\n🔗 LinkedIn OAuth Initiated');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`👤 User ID: ${req.user.id}`);
      console.log(`📧 User Email: ${req.user.email || 'N/A'}`);
      console.log(`🔐 State: ${state.substring(0, 20)}...`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Return auth URL and state to frontend
      sendResponse(res, 200, 'LinkedIn auth URL generated', {
        authUrl: authUrl.toString(),
        state,
      });
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async handleCallback(req, res) {
    try {
      const { code, state } = req.query;

      if (!code) {
        const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/job?linkedin=error&message=Authorization code missing`);
      }

      // Extract userId from state (format: "randomState:userId")
      // Handle URL-encoded state parameter
      const decodedState = decodeURIComponent(state || '');
      let finalUserId = null;
      if (decodedState && decodedState.includes(':')) {
        const parts = decodedState.split(':');
        finalUserId = parts[parts.length - 1]; // Get last part (userId)
      }

      if (!finalUserId) {
        const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/job?linkedin=error&message=Invalid state parameter. Please try connecting again.`);
      }

      // Exchange code for access token
      const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: env.LINKEDIN_REDIRECT_URI,
          client_id: env.LINKEDIN_CLIENT_ID,
          client_secret: env.LINKEDIN_CLIENT_SECRET,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`LinkedIn token exchange failed: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      const { access_token, expires_in } = tokenData;

      // Get user info from LinkedIn
      const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch LinkedIn user info');
      }

      const userInfo = await userInfoResponse.json();
      const { sub, name, email, picture } = userInfo;

      // Save token to database
      await linkedinService.saveToken(
        finalUserId,
        sub,
        access_token,
        expires_in,
        name,
        picture,
        email || null
      );

      // Log successful connection to terminal
      console.log('\n✅ LinkedIn Account Connected Successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`👤 User ID: ${finalUserId}`);
      console.log(`🔗 LinkedIn User: ${name || 'N/A'}`);
      console.log(`📧 Email: ${email || 'N/A'}`);
      console.log(`🆔 LinkedIn Sub: ${sub}`);
      console.log(`⏰ Token Expires: ${new Date(Date.now() + expires_in * 1000).toLocaleString()}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Redirect to frontend with success indicator
      const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/job?linkedin=connected`);
    } catch (error) {
      console.error('\n❌ LinkedIn Connection Failed!');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        console.error(`Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/job?linkedin=error&message=${encodeURIComponent(error.message)}`);
    }
  },

  async getStatus(req, res) {
    try {
      if (!req.user) {
        return sendError(res, 401, 'Authentication required');
      }

      const status = await linkedinService.getStatus(req.user.id);
      sendResponse(res, 200, 'LinkedIn connection status', status);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async postJob(req, res) {
    try {
      if (!req.user) {
        return sendError(res, 401, 'Authentication required');
      }

      const { jobTitle, company, description, applyUrl, location } = req.body;

      if (!jobTitle || !company || !applyUrl) {
        return sendError(res, 400, 'Job title, company, and apply URL are required');
      }

      const result = await linkedinService.postJob(req.user.id, {
        jobTitle,
        company,
        description,
        applyUrl,
        location,
      });

      // Log successful job post to terminal
      console.log('\n📢 Job Posted to LinkedIn Successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`👤 User ID: ${req.user.id}`);
      console.log(`💼 Job Title: ${jobTitle}`);
      console.log(`🏢 Company: ${company}`);
      console.log(`🔗 Post URL: ${result.linkedinPostUrl}`);
      console.log(`🆔 Post ID: ${result.postId || 'N/A'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      sendResponse(res, 200, 'Job posted to LinkedIn successfully', result);
    } catch (error) {
      if (error.message.includes('expired') || error.message.includes('not connected')) {
        return sendError(res, 401, error.message);
      }
      if (error.message.includes('rate limit')) {
        return sendError(res, 429, error.message);
      }
      sendError(res, 500, error.message, error);
    }
  },

  async disconnect(req, res) {
    try {
      if (!req.user) {
        return sendError(res, 401, 'Authentication required');
      }

      await linkedinService.deleteToken(req.user.id);
      
      // Log disconnection to terminal
      console.log('\n🔌 LinkedIn Account Disconnected');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`👤 User ID: ${req.user.id}`);
      console.log(`📧 User Email: ${req.user.email || 'N/A'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      sendResponse(res, 200, 'LinkedIn disconnected successfully');
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
