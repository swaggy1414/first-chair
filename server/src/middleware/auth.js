export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or missing token' });
  }
}

export function authorize(...roles) {
  return async function (request, reply) {
    if (!roles.includes(request.user.role)) {
      reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient permissions' });
    }
  };
}
