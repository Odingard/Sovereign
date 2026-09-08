"use client";

/**
 * @file Early Access Form Component
 * @description Production-ready lead generation form collecting business demographic details.
 * Strictly forbids patient information / PHI and validates all inputs.
 */

import { trackEvent } from "@/lib/analytics/events";
import { getStoredUtmParameters } from "@/lib/attribution/utm";
import type { EarlyAccessFormData } from "@/lib/lead-capture/types";
import { validateEarlyAccessForm } from "@/lib/lead-capture/validation";
import { type FormEvent, useEffect, useState } from "react";

export function EarlyAccessForm({ initialProgram }: { initialProgram?: string }) {
  const [formData, setFormData] = useState<EarlyAccessFormData>({
    firstName: "",
    lastName: "",
    workEmail: "",
    organization: "",
    role: "",
    practiceSize: "",
    locationCount: "",
    currentEhr: "",
    message: initialProgram
      ? `Interested in the Sovereign ${initialProgram} design partner program.`
      : "",
    honeypot: "",
    formRenderedAt: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, formRenderedAt: Date.now() }));
  }, []);

  const handleFieldChange = (name: keyof EarlyAccessFormData, value: string) => {
    if (!hasStarted) {
      setHasStarted(true);
      trackEvent("form_start", { formStep: "early_access_form" });
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    // Client-side validation
    const validation = validateEarlyAccessForm(formData, false);
    if (!validation.isValid) {
      setErrors(validation.errors);
      trackEvent("form_error", {
        errorMessage: "Client validation failed",
        errors: validation.errors,
      });
      return;
    }

    setIsSubmitting(true);
    trackEvent("form_submit", { practiceSize: formData.practiceSize, role: formData.role });

    try {
      const utm = getStoredUtmParameters();
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          utm,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitSuccess(true);
        trackEvent("form_success", { leadId: data.leadId });
      } else {
        if (data.errors) {
          setErrors(data.errors);
        }
        setGlobalError(data.message || "Unable to submit your request. Please try again.");
        trackEvent("form_error", { errorMessage: data.message });
      }
    } catch (err) {
      setGlobalError("Network connection error. Please try again shortly.");
      trackEvent("form_error", { errorMessage: "Network error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="form-wrapper form-success-card" aria-live="polite">
        <div className="success-icon-wrapper" aria-hidden="true">
          &check;
        </div>
        <h3 className="success-title">Request Received</h3>
        <p className="success-body">
          Thank you for requesting early access to Sovereign. Our clinical and product leadership
          team will review your practice information and reach out to schedule an introductory
          discussion.
        </p>
        <div style={{ marginTop: "1.5rem" }}>
          <a href="/" className="btn btn-secondary">
            Return to Homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="form-wrapper">
      <div className="form-header">
        <h2 className="form-title">Request Early Access</h2>
        <p className="form-subtitle">
          Join physician-led rheumatology practices participating in Sovereign’s design-partner
          evaluation.
        </p>
      </div>

      {/* Mandatory Patient Information Disclaimer */}
      <div className="phi-warning-banner" role="alert">
        <span className="phi-warning-icon" aria-hidden="true">
          &#9888;
        </span>
        <div>
          <strong>Important Practice Notice:</strong> Please do not submit patient information or
          protected health information. Sovereign collects business contact details only.
        </div>
      </div>

      {globalError && (
        <div className="form-error-alert" role="alert">
          {globalError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Anti-spam honeypot field (hidden from screen and keyboard) */}
        <input
          type="text"
          name="website_url_hp"
          className="hp-field"
          value={formData.honeypot || ""}
          onChange={(e) => handleFieldChange("honeypot", e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <div className="form-grid">
          {/* First Name */}
          <div className="form-group">
            <label htmlFor="field-firstName" className="form-label">
              First Name *
            </label>
            <input
              id="field-firstName"
              type="text"
              className={`form-input ${errors.firstName ? "form-input-error" : ""}`}
              placeholder="e.g. Jane"
              value={formData.firstName}
              onChange={(e) => handleFieldChange("firstName", e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.firstName)}
            />
            {errors.firstName && (
              <span className="field-error" role="alert">
                {errors.firstName}
              </span>
            )}
          </div>

          {/* Last Name */}
          <div className="form-group">
            <label htmlFor="field-lastName" className="form-label">
              Last Name *
            </label>
            <input
              id="field-lastName"
              type="text"
              className={`form-input ${errors.lastName ? "form-input-error" : ""}`}
              placeholder="e.g. Smith, MD"
              value={formData.lastName}
              onChange={(e) => handleFieldChange("lastName", e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.lastName)}
            />
            {errors.lastName && (
              <span className="field-error" role="alert">
                {errors.lastName}
              </span>
            )}
          </div>

          {/* Work Email */}
          <div className="form-group">
            <label htmlFor="field-workEmail" className="form-label">
              Work Email *
            </label>
            <input
              id="field-workEmail"
              type="email"
              className={`form-input ${errors.workEmail ? "form-input-error" : ""}`}
              placeholder="jsmith@practice.com"
              value={formData.workEmail}
              onChange={(e) => handleFieldChange("workEmail", e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.workEmail)}
            />
            {errors.workEmail && (
              <span className="field-error" role="alert">
                {errors.workEmail}
              </span>
            )}
          </div>

          {/* Organization / Practice Name */}
          <div className="form-group">
            <label htmlFor="field-organization" className="form-label">
              Practice or Organization Name *
            </label>
            <input
              id="field-organization"
              type="text"
              className={`form-input ${errors.organization ? "form-input-error" : ""}`}
              placeholder="e.g. Cascade Rheumatology Associates"
              value={formData.organization}
              onChange={(e) => handleFieldChange("organization", e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.organization)}
            />
            {errors.organization && (
              <span className="field-error" role="alert">
                {errors.organization}
              </span>
            )}
          </div>

          {/* Role */}
          <div className="form-group">
            <label htmlFor="field-role" className="form-label">
              Your Role / Title *
            </label>
            <select
              id="field-role"
              className={`form-select ${errors.role ? "form-input-error" : ""}`}
              value={formData.role}
              onChange={(e) => handleFieldChange("role", e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.role)}
            >
              <option value="">Select your role...</option>
              <option value="Rheumatologist / Physician">Rheumatologist / Physician</option>
              <option value="Practice Administrator / Executive">
                Practice Administrator / Executive
              </option>
              <option value="Nurse / Medical Assistant">Nurse / Medical Assistant</option>
              <option value="Prior Authorization / Access Specialist">
                Prior Authorization / Access Specialist
              </option>
              <option value="Clinical Operations Director">Clinical Operations Director</option>
              <option value="Other Healthcare Professional">Other Healthcare Professional</option>
            </select>
            {errors.role && (
              <span className="field-error" role="alert">
                {errors.role}
              </span>
            )}
          </div>

          {/* Practice Size */}
          <div className="form-group">
            <label htmlFor="field-practiceSize" className="form-label">
              Practice Size *
            </label>
            <select
              id="field-practiceSize"
              className={`form-select ${errors.practiceSize ? "form-input-error" : ""}`}
              value={formData.practiceSize}
              onChange={(e) => handleFieldChange("practiceSize", e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.practiceSize)}
            >
              <option value="">Select number of clinicians...</option>
              <option value="1-2 clinicians">Solo / Small (1-2 clinicians)</option>
              <option value="3-5 clinicians">Mid-size (3-5 clinicians)</option>
              <option value="6-15 clinicians">Large Group (6-15 clinicians)</option>
              <option value="16+ clinicians">Enterprise (16+ clinicians)</option>
            </select>
            {errors.practiceSize && (
              <span className="field-error" role="alert">
                {errors.practiceSize}
              </span>
            )}
          </div>

          {/* Location Count */}
          <div className="form-group">
            <label htmlFor="field-locationCount" className="form-label">
              Number of Practice Locations *
            </label>
            <select
              id="field-locationCount"
              className={`form-select ${errors.locationCount ? "form-input-error" : ""}`}
              value={formData.locationCount}
              onChange={(e) => handleFieldChange("locationCount", e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.locationCount)}
            >
              <option value="">Select location count...</option>
              <option value="1 location">Single Location</option>
              <option value="2-4 locations">2 to 4 Locations</option>
              <option value="5+ locations">5+ Locations</option>
            </select>
            {errors.locationCount && (
              <span className="field-error" role="alert">
                {errors.locationCount}
              </span>
            )}
          </div>

          {/* Current EHR (Optional) */}
          <div className="form-group">
            <label htmlFor="field-currentEhr" className="form-label">
              Current EHR System <span className="label-optional">(Optional)</span>
            </label>
            <input
              id="field-currentEhr"
              type="text"
              className="form-input"
              placeholder="e.g. Epic, Athenahealth, NextGen, eCW"
              value={formData.currentEhr || ""}
              onChange={(e) => handleFieldChange("currentEhr", e.target.value)}
            />
          </div>

          {/* Message / Goals (Optional) */}
          <div className="form-group form-group-full">
            <label htmlFor="field-message" className="form-label">
              Message or Specific Practice Challenges{" "}
              <span className="label-optional">(Optional — Business Inquiries Only)</span>
            </label>
            <textarea
              id="field-message"
              className={`form-textarea ${errors.message ? "form-input-error" : ""}`}
              placeholder="Tell us about your practice workflows, biologic access pain points, or questions about the design partner program..."
              value={formData.message || ""}
              onChange={(e) => handleFieldChange("message", e.target.value)}
              maxLength={2000}
            />
            {errors.message && (
              <span className="field-error" role="alert">
                {errors.message}
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%", maxWidth: "360px" }}
            disabled={isSubmitting}
            id="early-access-submit-btn"
          >
            {isSubmitting ? "Submitting Request..." : "Submit Early Access Request"}
          </button>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.75rem" }}>
            By submitting, you agree to our{" "}
            <a href="/terms" style={{ textDecoration: "underline" }}>
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" style={{ textDecoration: "underline" }}>
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </form>
    </div>
  );
}
