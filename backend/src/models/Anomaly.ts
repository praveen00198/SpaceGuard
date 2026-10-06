import mongoose, { Schema, Document } from 'mongoose';
import { IAnomaly } from '../shared/types';

export interface IAnomalyDocument extends IAnomaly, Document {}

const AnomalySchema = new Schema<IAnomalyDocument>(
  {
    anomalyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    satelliteId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    detectedAt: {
      type: Date,
      required: true,
      index: true,
    },
    detectionMethod: {
      type: String,
      required: true,
      enum: ['rule', 'statistical', 'ml', 'hybrid'],
    },
    anomalyScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    severity: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'critical'],
      index: true,
    },
    parameter: {
      type: String,
      required: true,
      trim: true,
    },
    subsystem: {
      type: String,
      required: true,
      enum: ['power', 'thermal', 'communication', 'attitude', 'payload'],
      index: true,
    },
    value: {
      type: Number,
      required: true,
    },
    baseline: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    anomalyType: {
      type: String,
      required: true,
      enum: ['spike', 'drift', 'dropout', 'flatline', 'oscillation', 'threshold', 'variance_change'],
    },
    evidenceIds: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'investigating', 'resolved', 'dismissed'],
      default: 'active',
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    collection: 'anomalies',
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

AnomalySchema.index({ satelliteId: 1, detectedAt: -1 });
AnomalySchema.index({ satelliteId: 1, status: 1 });

export const AnomalyModel =
  mongoose.models.Anomaly || mongoose.model<IAnomalyDocument>('Anomaly', AnomalySchema);
