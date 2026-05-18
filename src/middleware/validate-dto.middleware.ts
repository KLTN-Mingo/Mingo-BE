import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { ValidationError } from "../errors";

export function validateDto<T extends object>(DtoClass: new () => T) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const dto = plainToInstance(DtoClass, req.body);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const constraints = errors
        .flatMap((error) => Object.values(error.constraints || {}))
        .filter(Boolean);
      const message = constraints[0] || "Payload không hợp lệ";
      return next(new ValidationError(message, "DTO_VALIDATION_ERROR"));
    }

    req.body = dto;
    next();
  };
}
