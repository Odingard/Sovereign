/**
 * @file Early Access Form Validation & Anti-Abuse Rules
 * @description Validates required business fields, rejects consumer spam,
 * and actively protects against accidental PHI submission.
 */

import type { EarlyAccessFormData } from "./types";

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: Record<string, string>;
  readonly isSpam?: boolean;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Warning keywords to prevent inadvertent submission of patient information
const PHI_INDICATOR_REGEX =
  /\b(mrn\b|mrn\d|dob\b|date of birth|ssn\b|ssn\d|social security|patient name|patient id|diagnosis|medical record)/i;

export function validateEarlyAccessForm(
  data: Partial<EarlyAccessFormData>,
  isServer = false,
): ValidationResult {
  const errors: Record<string, string> = {};

  if (
    isServer &&
    (typeof data.submissionId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(data.submissionId))
  ) {
    errors.submissionId = "A valid submission identifier is required.";
  }

  const stringFields = [
    "firstName",
    "lastName",
    "workEmail",
    "organization",
    "role",
    "practiceSize",
    "locationCount",
    "currentEhr",
    "message",
    "honeypot",
  ] as const;
  for (const field of stringFields) {
    const value = data[field];
    if (value !== undefined && typeof value !== "string") {
      errors[field] = "Invalid field type.";
    }
  }
  if (Object.values(errors).some((error) => error === "Invalid field type.")) {
    return { isValid: false, errors };
  }

  // 1. Anti-spam honeypot check (server-side and client-side)
  if (data.honeypot && data.honeypot.trim().length > 0) {
    return {
      isValid: false,
      isSpam: true,
      errors: { honeypot: "Automated submission rejected." },
    };
  }

  // 2. Anti-bot timestamp check (minimum 1 second to complete form)
  if (isServer && data.formRenderedAt) {
    const elapsedMs = Date.now() - data.formRenderedAt;
    if (elapsedMs < 1000) {
      return {
        isValid: false,
        isSpam: true,
        errors: { form: "Submission was too fast. Please try again." },
      };
    }
  }

  // 3. First Name
  const firstName = (data.firstName || "").trim();
  if (!firstName) {
    errors.firstName = "First name is required.";
  } else if (firstName.length > 60) {
    errors.firstName = "First name must be 60 characters or fewer.";
  }

  // 4. Last Name
  const lastName = (data.lastName || "").trim();
  if (!lastName) {
    errors.lastName = "Last name is required.";
  } else if (lastName.length > 60) {
    errors.lastName = "Last name must be 60 characters or fewer.";
  }

  // 5. Work Email
  const email = (data.workEmail || "").trim();
  if (!email) {
    errors.workEmail = "Work email is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.workEmail = "Please enter a valid work email address.";
  } else if (email.length > 120) {
    errors.workEmail = "Email address is too long.";
  }

  // 6. Organization / Practice Name
  const org = (data.organization || "").trim();
  if (!org) {
    errors.organization = "Practice or organization name is required.";
  } else if (org.length < 2) {
    errors.organization = "Organization name must be at least 2 characters.";
  } else if (org.length > 100) {
    errors.organization = "Organization name must be 100 characters or fewer.";
  }

  // 7. Role / Title
  const role = (data.role || "").trim();
  if (!role) {
    errors.role = "Role or job title is required.";
  } else if (role.length > 80) {
    errors.role = "Role must be 80 characters or fewer.";
  }

  // 8. Practice Size
  const size = (data.practiceSize || "").trim();
  if (!size) {
    errors.practiceSize = "Please select your practice size range.";
  }

  // 9. Number of Locations
  const locations = (data.locationCount || "").trim();
  if (!locations) {
    errors.locationCount = "Please select your number of locations.";
  }

  // 10. Optional EHR vendor
  if (data.currentEhr && data.currentEhr.length > 100) {
    errors.currentEhr = "EHR name must be 100 characters or fewer.";
  }

  // 11. Optional Message & Strict PHI guard
  if (data.message) {
    if (data.message.length > 2000) {
      errors.message = "Message must be 2000 characters or fewer.";
    }
    if (PHI_INDICATOR_REGEX.test(data.message)) {
      errors.message =
        "Your message appears to contain patient information. Please remove all patient details and submit business inquiries only.";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
