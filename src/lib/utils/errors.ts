// Erreurs métier typées : chaque route API les attrape pour renvoyer un code HTTP
// et un message compréhensible, plutôt que de laisser fuiter une stack trace.

export class AppError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentification requise.") {
    super(message, 401, "UNAUTHENTICATED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Vous n'avez pas les droits nécessaires pour cette action.") {
    super(message, 403, "FORBIDDEN");
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Ressource introuvable.") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class InvalidTransitionError extends AppError {
  constructor(message: string) {
    super(message, 409, "INVALID_TRANSITION");
  }
}

export function toApiError(error: unknown): { httpStatus: number; body: { error: string; code: string } } {
  if (error instanceof AppError) {
    return { httpStatus: error.httpStatus, body: { error: error.message, code: error.code } };
  }
  // Erreur non anticipée : ne jamais renvoyer le détail interne au client.
  console.error(error);
  return { httpStatus: 500, body: { error: "Une erreur interne est survenue.", code: "INTERNAL_ERROR" } };
}
