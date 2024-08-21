import models from "../database/models/models.js";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import gravatar from "gravatar";
import mongoose from "mongoose";
const userResolvers = {
  User: {
    notes: async (user, args, { models }) => {
      return await models.Note.find({ author: user._id }).sort({ _id: -1 });
    },
    favorites: async (user, args, { models }) => {
      return await models.Note.find({ favoritedBy: user._id }).sort({ _id: -1 });
    },
  },
  Mutation: {
    signUp: async (parent, args) => {
      args.email = args.email.trim().toLowerCase();
      const avatar = gravatar.url(args.email);
      const hashed = await bcrypt.hash(args.password, 10);
      try {
        const existingUser = await models.User.findOne({
          $or: [{ email: args.email }, { username: args.username }],
        });
        if (existingUser) {
          throw new Error("User with this email or username already exists");
        }
        const user = await models.User.create({
          username: args.username,
          password: hashed,
          email: args.email,
          avatar: "https:" + avatar,
        });
        return jwt.sign({ id: user._id }, process.env.JWT_SECRET);
      } catch (err) {
        console.error("Error creating account:", err);
        throw new Error("Failed to create account");
      }
    },
    signIn: async (parent, args) => {
      try {
        const user = await models.User.findOne({
          $or: [{ email: args.email }, { username: args.username }],
        });
        if (!user) {
          throw new Error("User with this email does not exist");
        }
        const valid = await bcrypt.compare(args.password, user.password);
        if (!valid) {
          throw new Error("Incorrect password");
        }
        return jwt.sign({ id: user._id }, process.env.JWT_SECRET);
      } catch (err) {
        console.error("Error signing in:", err);
        throw new Error("Failed to sign in");
      }
    },
    toggleFavorite: async (parent, args, { models, user }) => {
      if (!user) {
        throw new Error("User with this email does not exist");
      }
      let noteCheck = await models.Note.findById(args.id);
      const hasUser = noteCheck.favoritedBy.indexOf(user.id);
      if (hasUser >= 0) {
        return await models.Note.findByIdAndUpdate(
          args.id,
          {
            $pull: {
              favoritedBy: mongoose.Types.ObjectId.createFromHexString(user.id),
            },
            $inc: {
              favoriteCount: -1,
            },
          },
          {
            new: true,
          }
        );
      } else {
        return await models.Note.findByIdAndUpdate(
          args.id,
          {
            $push: {
              favoritedBy: mongoose.Types.ObjectId.createFromHexString(user.id),
            },
            $inc: {
              favoriteCount: 1,
            },
          },
          {
            new: true,
          }
        );
      }
    },
  },
};

export default userResolvers;
