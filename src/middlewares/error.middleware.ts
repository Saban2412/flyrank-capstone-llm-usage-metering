import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // 1. Ako je greška došla iz Zod validacije -> 400 Bad Request
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validacija podataka nije uspjela.",
      detalji: err.issues.map((issue) => ({
        polje: issue.path.join("."),
        poruka: issue.message,
      })),
    });
    return;
  }

  // 2. Ako je naša poznata aplikacijska greška (NotFoundError, BadRequestError...)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // 3. Nepredviđena greška na serveru
  console.error("[UNEXPECTED ERROR]:", err);
  res.status(500).json({
    error: "Došlo je do neočekivane greške na serveru.",
  });
}
