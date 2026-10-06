import mongoose, { Schema, Document } from 'mongoose';
import { IHealthSnapshot } from '../shared/types';

export interface IHealthSnapshotDocument extends IHealthSnapshot, Document {}

const SubsystemHealthSchema = new Schema(
  {
    score: { type: Number, required: true, min: 0, max: 100 },
    status: {
      type: String,
      required: true,
      enum: ['nominal', 'degraded', 'critical', 'unknown'],
    },
  },
  { _id: false }
);

const HealthSnapshotSchema = new Schema<IHealthSnapshotDocument>(
  {
    satelliteId: {
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
    subsystems: {
      power: { type: SubsystemHealthSchema, required: true },
      thermal: { type: SubsystemHealthSchema, required: true },
      communication: { type: SubsystemHealthSchema, required: true },
      attitude: { type: SubsystemHealthSchema, required: true },
      payload: { type: SubsystemHealthSchema, required: true },
    },
    overallHealth: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    overallStatus: {
      type: String,
      required: true,
      enum: ['nominal', 'degraded', 'critical', 'unknown'],
      index: true,
    },
    activeAnomalies: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    collection: 'healthSnapshots',
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

HealthSnapshotSchema.index({ satelliteId: 1, timestamp: -1 });

export const HealthSnapshotModel =
  mongoose.models.HealthSnapshot ||
  mongoose.model<IHealthSnapshotDocument>('HealthSnapshot', HealthSnapshotSchema);
