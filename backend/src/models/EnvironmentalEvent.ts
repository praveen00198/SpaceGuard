import mongoose, { Schema, Document } from 'mongoose';
import { IEnvironmentalEvent } from '../shared/types';

export interface IEnvironmentalEventDocument extends IEnvironmentalEvent, Document {}

const EnvironmentalEventSchema = new Schema<IEnvironmentalEventDocument>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    source: {
      type: String,
      required: true,
      enum: ['noaa_swpc', 'nasa_donki'],
      index: true,
    },
    eventType: {
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
    endTime: {
      type: Date,
      required: false,
    },
    severity: {
      type: String,
      required: false,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    rawData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    retrievedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: 'environmentalEvents',
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

// Compound index for efficient temporal window correlation queries
EnvironmentalEventSchema.index({ timestamp: -1, eventType: 1 });
EnvironmentalEventSchema.index({ source: 1, timestamp: -1 });

export const EnvironmentalEventModel =
  mongoose.models.EnvironmentalEvent ||
  mongoose.model<IEnvironmentalEventDocument>('EnvironmentalEvent', EnvironmentalEventSchema);
