const jwt = require('jsonwebtoken');

const JWT_SECRET = "your_super_secret_jwt_key_here";
const payload = {
  id: "6a08259b752e15d6a06ec471",
  email: "sarah.connor@hryantra.com",
  role: "HR",
  employeeId: "6a08259b752e15d6a06ec477"
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });
console.log("GENERATED_TOKEN:", token);
