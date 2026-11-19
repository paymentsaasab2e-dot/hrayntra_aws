const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';

const payload = {
  id: 'some-user-id',
  employeeId: 'EMP-001',
  role: 'HR'
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1y' });

console.log('Dev Token (1 year):');
console.log(token);
