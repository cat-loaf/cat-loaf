const jwt = require('jsonwebtoken');

exports.handler = async function(event){
  try{
    const body = event.body ? JSON.parse(event.body) : {};
    const user = body.user || body.username || '';
    const pass = body.pass || body.password || '';

  // Provide safe defaults so admin works out-of-the-box; override these in Netlify env for production.
  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
  const JWT_SECRET = process.env.JWT_SECRET || 'change-this-jwt-secret';
    const JWT_EXPIRES = process.env.JWT_EXPIRES || '1h';

    // note: defaults are used when env vars are not set. Change ADMIN_USER and ADMIN_PASS in Netlify for security.
    if(!user || !pass || user !== ADMIN_USER || pass !== ADMIN_PASS){
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid credentials' }) };
    }

    const token = jwt.sign({ user }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, expiresIn: JWT_EXPIRES }) };
  }catch(err){
    return { statusCode: 400, body: JSON.stringify({ error: String(err) }) };
  }
};
