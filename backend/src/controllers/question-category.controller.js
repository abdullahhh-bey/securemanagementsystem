
import prisma from "../../db/db.js";
import { AuditAction, AuditEntityType, writeAuditLog } from "../utils/audit.js";

// CREATE CATEGORY
const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required.",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a string or null.",
      });
    }

    const category = await prisma.questionCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    await writeAuditLog(prisma, {
      actorId: req.user.id,
      action: AuditAction.CATEGORY_CREATED,
      entityType: AuditEntityType.CATEGORY,
      entityId: category.id,
      newValues: {
        name: category.name,
        description: category.description,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Question category created successfully.",
      data: category,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A category with this name already exists.",
      });
    }

    console.error("Create category error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create question category.",
    });
  }
};

// GET ALL CATEGORIES
const getCategories = async (req, res) => {
  try {
    const categories = await prisma.questionCategory.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve question categories.",
    });
  }
};

// UPDATE CATEGORY
const updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description } = req.body;

    const existingCategory = await prisma.questionCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Question category not found.",
      });
    }

    const data = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category name cannot be empty.",
        });
      }

      data.name = name.trim();
    }

    if (description !== undefined) {
      if (
        description !== null &&
        typeof description !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Description must be a string or null.",
        });
      }

      data.description = description?.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    const updatedCategory = await prisma.questionCategory.update({
      where: { id: categoryId },
      data,
    });

    await writeAuditLog(prisma, {
      actorId: req.user.id,
      action: AuditAction.CATEGORY_UPDATED,
      entityType: AuditEntityType.CATEGORY,
      entityId: updatedCategory.id,
      oldValues: {
        name: existingCategory.name,
        description: existingCategory.description,
      },
      newValues: {
        name: updatedCategory.name,
        description: updatedCategory.description,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Question category updated successfully.",
      data: updatedCategory,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A category with this name already exists.",
      });
    }

    console.error("Update category error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update question category.",
    });
  }
};

// DELETE CATEGORY
const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await prisma.questionCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Question category not found.",
      });
    }

    if (category._count.questions > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a category that contains questions.",
      });
    }

    await prisma.questionCategory.delete({
      where: { id: categoryId },
    });

    await writeAuditLog(prisma, {
      actorId: req.user.id,
      action: AuditAction.CATEGORY_DELETED,
      entityType: AuditEntityType.CATEGORY,
      entityId: categoryId,
      oldValues: {
        name: category.name,
        description: category.description,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Question category deleted successfully.",
    });
  } catch (error) {
    console.error("Delete category error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete question category.",
    });
  }
};

export {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
