import { createSafeActionClient } from "next-safe-action";
import { getServerSession } from "@/lib/auth/session";

/**
 * Clases de error controladas para el cliente
 */
export class ActionError extends Error {
  constructor(
    message: string,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

export class ValidationError extends ActionError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ActionError {
  constructor(resource: string) {
    super(`${resource} no encontrado`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends ActionError {
  constructor(message = "No autorizado") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ActionError {
  constructor(message = "Permisos insuficientes") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends ActionError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
    this.name = "ConflictError";
  }
}

/**
 * Genera un ID de correlación para trazabilidad
 */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Sanitiza el mensaje de error para el cliente.
 *
 * Los repositorios lanzan Errores planos con mensajes de dominio en español
 * pensados para el usuario ("OC no encontrada", "Ya existe un producto con el
 * código X", etc.). Esos SÍ pasan al cliente. Lo que NO pasa son errores de
 * infraestructura (SQL crudo, credenciales, stack de driver), detectados por
 * marcadores internos conocidos.
 */
function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof ActionError) {
    return error.message;
  }
  if (error instanceof Error) {
    const marcadoresInternos = [
      "Invalid `prisma", // dump de invocación de Prisma
      "PrismaClientUnknownRequestError",
      "PrismaClientRustPanicError",
      "PrismaClientValidationError",
      "error: connect", // pg / driver
      "ECONNREFUSED",
      "Connection terminated unexpectedly",
      "password authentication failed",
      "getaddrinfo",
      "self signed certificate",
    ];
    if (marcadoresInternos.some((m) => error.message.includes(m))) {
      // Mensajes de Prisma conocidos que son seguros (whitelist histórica)
      const safeMessages = [
        "Unique constraint failed",
        "Foreign key constraint failed",
        "Record to update not found",
        "Record to delete does not exist",
      ];
      const seguro = safeMessages.find((m) => error.message.includes(m));
      return seguro ?? "Error interno del servidor";
    }
    return error.message;
  }
  // Genérico para todo lo demás
  return "Error interno del servidor";
}



/**
 * Registra el error completo en servidor con contexto
 */
async function logServerError(
  error: unknown,
  context: {
    actionName: string;
    requestId: string;
    userId?: string;
    userEmail?: string;
    input?: unknown;
  },
) {
  const errorInfo = {
    requestId: context.requestId,
    actionName: context.actionName,
    userId: context.userId,
    userEmail: context.userEmail,
    timestamp: new Date().toISOString(),
    error: error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : { message: String(error) },
    input: context.input,
  };

  // Log a consola (en producción iría a servicio de logging: Datadog, Sentry, etc.)
  console.error("[ACTION_ERROR]", JSON.stringify(errorInfo, null, 2));

  // Opcional: persistir en BD para auditoría (si existe modelo auditLog)
  // try {
  //   await prisma.auditLog.create({ ... });
  // } catch { /* silencioso */ }
}

/**
 * Cliente de acciones seguro con manejo de errores controlado
 */
interface SafeActionUtils {
  ctx?: { actionName?: string };
  input?: unknown;
}

export const actionClient = createSafeActionClient({
  handleServerError: async (error, utils: SafeActionUtils) => {
    const requestId = generateRequestId();
    const actionName = utils.ctx?.actionName ?? "unknown_action";

    // Obtener sesión de usuario para contexto
    let userId: string | undefined;
    let userEmail: string | undefined;
    try {
      const session = await getServerSession();
      userId = session?.user?.id;
      userEmail = session?.user?.email;
    } catch {
      // Ignorar errores de sesión
    }

    // Log completo en servidor
    await logServerError(error, {
      actionName,
      requestId,
      userId,
      userEmail,
      input: utils.input,
    });

    // Devolver solo mensaje sanitizado al cliente (string)
    // El requestId y code se logean en servidor; cliente ve solo mensaje seguro
    return sanitizeErrorMessage(error);
  },
});

/**
 * Helper para lanzar errores de validación con issues de Zod
 */
export function validationError(message: string): never {
  throw new ValidationError(message);
}

/**
 * Helper para lanzar error de no encontrado
 */
export function notFound(resource: string): never {
  throw new NotFoundError(resource);
}

/**
 * Helper para lanzar error de no autorizado
 */
export function unauthorized(message?: string): never {
  throw new UnauthorizedError(message);
}

/**
 * Helper para lanzar error de permisos
 */
export function forbidden(message?: string): never {
  throw new ForbiddenError(message);
}

/**
 * Helper para lanzar error de conflicto
 */
export function conflict(message: string): never {
  throw new ConflictError(message);
}