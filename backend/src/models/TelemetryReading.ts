import mongoose, { Schema, Document } from 'mongoose';
import { ITelemetryReading } from '../shared/types';

export interface ITelemetryReadingDocument extends ITelemetryReading, Document {}

const TelemetryReadingSchema = new Schema<ITelemetryReadingDocument>(
  {
    satelliteId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    parameter: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    value: {
      type: Number,
      required: true,
    },
    unit: {
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
    source: {
      type: String,
      required: true,
      enum: ['simulator', 'satnogs', 'dataset', 'manual'],
      default: 'simulator',
    },
    sourceRecordId: {
      type: String,
      required: false,
    },
    sensorId: {
      type: String,
      required: false,
    },
    quality: {
      type: String,
      required: true,
      enum: ['valid', 'suspect', 'interpolated', 'missing', 'stale'],
      default: 'valid',
    },
    ingestedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    collection: 'telemetryReadings',
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

// High-performance compound indexes for time-series range queries and parameter lookups
TelemetryReadingSchema.index({ satelliteId: 1, timestamp: -1 });
TelemetryReadingSchema.index({ satelliteId: 1, parameter: 1, timestamp: -1 });
TelemetryReadingSchema.index({ satelliteId: 1, subsystem: 1, timestamp: -1 });

export const TelemetryReadingModel =
  mongoose.models.TelemetryReading ||
  mongoose.model<ITelemetryReadingDocument>('TelemetryReading', TelemetryReadingSchema);
