module.exports.jwt = {
  secretKey: process.env.JWT_SECRET_KEY || 'n0d3spr0j3ct-6ecr3t',
  issuer: 'urn:proyecto-nodos.com',
  expiresIn: '24h',	// 24 hours, other option 30 days
  algorithm: 'HS512'
};