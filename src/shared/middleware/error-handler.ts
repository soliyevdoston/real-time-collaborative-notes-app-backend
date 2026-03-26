import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { HttpError } from "../errors/http-error";

const isPrismaErrorCode = (value: unknown): value is string =>
  typeof value === "string" && /^P\d{4}$/.test(value);

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ message: "So'ralgan yo'nalish topilmadi" });
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      message: err.message,
      details: err.details,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Validatsiya xatosi",
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    res.status(500).json({
      message: "Database xatosi",
      code: err.code,
      details: err.meta ?? null,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    res.status(500).json({
      message: "Database ulanish xatosi",
      code: "PRISMA_INIT_ERROR",
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(500).json({
      message: "Database so'rov validatsiya xatosi",
      code: "PRISMA_VALIDATION_ERROR",
    });
    return;
  }

  // Some Prisma runtime errors may not pass `instanceof` checks after bundling.
  if (typeof err === "object" && err !== null) {
    const maybePrismaError = err as {
      code?: unknown;
      message?: unknown;
      meta?: unknown;
      name?: unknown;
    };

    if (isPrismaErrorCode(maybePrismaError.code)) {
      res.status(500).json({
        message: "Database xatosi",
        code: maybePrismaError.code,
        details: maybePrismaError.meta ?? null,
      });
      return;
    }

    if (
      typeof maybePrismaError.name === "string" &&
      maybePrismaError.name.toLowerCase().includes("prisma")
    ) {
      res.status(500).json({
        message: "Database xatosi",
        code: "PRISMA_RUNTIME_ERROR",
        details:
          typeof maybePrismaError.message === "string"
            ? maybePrismaError.message
            : null,
      });
      return;
    }
  }

  console.error(err);
  if (err instanceof Error) {
    res.status(500).json({
      message: "Server ichki xatosi",
      details: err.message,
    });
    return;
  }

  res.status(500).json({ message: "Server ichki xatosi", details: "Noma'lum xatolik" });
};
