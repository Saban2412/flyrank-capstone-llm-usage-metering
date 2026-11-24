// Osnovna klasa greške za našu aplikaciju koja nasljeđuje ugrađeni JS Error
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    // super(message) poziva konstruktor roditeljske klase (Error) i postavlja this.message
    super(message);
    this.statusCode = statusCode;
    // Održava ispravan lanac prototipova u TypeScriptu (važno za 'instanceof' provjeru!)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Specifična greška za 404 Not Found
export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(message, 404);
  }
}

// Specifična greška za 400 Bad Request
export class BadRequestError extends AppError {
  constructor(message = "Bad Request.") {
    super(message, 400);
  }
}
export class ToManyRequestError extends AppError {
  constructor(message = "To many requests.") {
    super(message, 429);
  }
}
export class PaymentRequiredError extends AppError {
  constructor(message = "Payment required.") {
    super(message, 402);
  }
}
