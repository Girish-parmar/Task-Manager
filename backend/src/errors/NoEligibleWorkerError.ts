import { AppError } from "./AppError";

export class NoEligibleWorkerError extends AppError {
  constructor(message = "No eligible worker found for this task") {
    super(422, message);
  }
}
