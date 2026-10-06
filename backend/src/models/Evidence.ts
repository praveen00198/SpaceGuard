import mongoose, { Schema, Document } from 'mongoose';
import { IEvidence } from '../shared/types';

export interface IEvidenceDocument extends IEvidence, Document {}

const EvidenceSchema = new Schema<IEvidenceDocument>(
  {
    evidenceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    source: {
      type: String,
      required: true,
      enum: ['telemetry', 'anomaly', 'environment', 'orbit', 'historical'],
      index: true,
    },
    sourceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    parameter: {
      type: String,
      required: false,
      trim: true,
    },
    value: {
      type: Number,
      required: false,
    },
    baseline: {
      type: Number,
      required: false,
    },
    unit: {
      type: String,
      required: false,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: 'evidence',
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

export const EvidenceModel =
  mongoose.models.Evidence || mongoose.model<IEvidenceDocument>('Evidence', EvidenceSchema);
