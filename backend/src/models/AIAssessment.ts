import mongoose, { Schema, Document } from 'mongoose';
import { IAIAssessment } from '../shared/types';

export interface IAIAssessmentDocument extends IAIAssessment, Document {}

const EvidenceClaimSchema = new Schema(
  {
    claim: { type: String, required: true },
    evidenceIds: { type: [String], required: true },
  },
  { _id: false }
);

const AIAssessmentSchema = new Schema<IAIAssessmentDocument>(
  {
    assessmentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    anomalyId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    satelliteId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    priority: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'critical'],
    },
    summary: {
      type: String,
      required: true,
    },
    evidenceClaims: {
      type: [EvidenceClaimSchema],
      default: [],
    },
    interpretation: {
      type: String,
      required: true,
    },
    possibleCauses: {
      type: [String],
      default: [],
    },
    known: {
      type: [String],
      default: [],
    },
    unknown: {
      type: [String],
      default: [],
    },
    cannotDetermine: {
      type: [String],
      default: [],
    },
    uncertainty: {
      type: String,
      required: true,
    },
    recommendedInvestigation: {
      type: [String],
      default: [],
    },
    modelUsed: {
      type: String,
      required: true,
    },
    promptVersion: {
      type: String,
      required: true,
    },
    requestedAt: {
      type: Date,
      required: true,
    },
    respondedAt: {
      type: Date,
      required: true,
    },
    latencyMs: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['success', 'error', 'timeout'],
      default: 'success',
    },
    errorMessage: {
      type: String,
      required: false,
    },
  },
  {
    collection: 'aiAssessments',
    timestamps: false,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

AIAssessmentSchema.index({ satelliteId: 1, requestedAt: -1 });

export const AIAssessmentModel =
  mongoose.models.AIAssessment ||
  mongoose.model<IAIAssessmentDocument>('AIAssessment', AIAssessmentSchema);
