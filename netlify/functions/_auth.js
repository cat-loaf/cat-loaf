const jwt = require('jsonwebtoken');

function getAuthHeader(event){
  return (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
}

function requireAuth(event){
  const auth = getAuthHeader(event);
  const parts = String(auth).split(' ');
  if(parts.length !== 2 || parts[0] !== 'Bearer'){
    const e = new Error('Missing or invalid Authorization header');
    e.status = 401; throw e;
  }
  const token = parts[1];
  // Use same default as login.js so local dev works without env vars. Override in Netlify env for production.
  const JWT_SECRET = process.env.JWT_SECRET || 'change-this-jwt-secret';
  if(!JWT_SECRET){ const e = new Error('Server misconfigured: missing JWT_SECRET'); e.status = 500; throw e; }
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    return payload;
  }catch(err){
    const e = new Error('Invalid token'); e.status = 401; throw e;
  }
}

module.exports = { requireAuth };
