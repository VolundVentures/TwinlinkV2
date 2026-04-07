import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getTemplates, getTemplateById } from "@/lib/ai/video-templates";

export const useTemplateDefinition: ToolDefinition = {
  name: "use_template",
  description:
    "Browse and execute video ad templates. Use action='list' to see available templates (optionally filtered by category or platform). Use action='execute' to get the step-by-step execution plan for a template. Templates define structured workflows: which images to generate, which models to use for animation, and how to compose the final video. After getting the plan, execute each step using the appropriate tools. Costs 0 credits (actual generation tools charge credits).",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "execute"],
        description:
          "'list' to browse templates, 'execute' to get the execution plan for a specific template.",
      },
      template_id: {
        type: "string",
        description: "Template ID to execute. Required for 'execute' action.",
      },
      category: {
        type: "string",
        enum: ["ugc", "product", "testimonial", "tech", "social_proof", "hook"],
        description: "Filter templates by category (for 'list' action).",
      },
      platform: {
        type: "string",
        enum: ["tiktok", "instagram", "linkedin", "youtube"],
        description: "Filter templates by platform (for 'list' action).",
      },
    },
    required: ["action"],
  },
};

export const useTemplateTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const action = input.action as string;

  if (action === "list") {
    const category = input.category as string | undefined;
    const platform = input.platform as string | undefined;

    const templates = getTemplates({ category, platform });

    if (templates.length === 0) {
      return {
        success: true,
        content: "No templates found matching the given filters.",
      };
    }

    const listing = templates
      .map(
        (t) =>
          `${t.icon} **${t.name}** (${t.id})\n` +
          `   ${t.description}\n` +
          `   Category: ${t.category} | Platform: ${t.platform} | ${t.estimatedDuration} | ~${t.estimatedCredits} credits | ${t.aspectRatio}\n` +
          `   Steps: ${t.steps.map((s) => s.tool).join(" → ")}`
      )
      .join("\n\n");

    return {
      success: true,
      content: `Available templates (${templates.length}):\n\n${listing}`,
    };
  }

  if (action === "execute") {
    const templateId = input.template_id as string;
    if (!templateId) {
      return {
        success: false,
        content: "template_id is required for 'execute' action.",
      };
    }

    const template = getTemplateById(templateId);
    if (!template) {
      return {
        success: false,
        content: `Template '${templateId}' not found. Use action='list' to see available templates.`,
      };
    }

    // Build execution plan
    const brand = context.brand;
    const plan = template.steps.map((step, i) => {
      const stepInfo = [
        `Step ${i + 1}: ${step.tool}`,
        `   ${step.description}`,
        `   Parameters: ${JSON.stringify(step.params)}`,
        step.dependsOn
          ? `   Depends on: ${step.dependsOn.join(", ")} (use their output as input)`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      return stepInfo;
    });

    const contextNotes: string[] = [];
    if (brand) {
      contextNotes.push(`Brand: ${brand.name}`);
      if (brand.products && brand.products.length > 0) {
        const productWithImage = brand.products.find(
          (p) => p.image_url
        );
        if (productWithImage) {
          contextNotes.push(
            `Product with image available: ${productWithImage.name} (${productWithImage.image_url})`
          );
          contextNotes.push(
            "Pass this as reference_image_urls or product_image_url in relevant steps."
          );
        }
      }
    }

    const summary = [
      `Template: ${template.icon} ${template.name}`,
      `${template.description}`,
      `Estimated: ~${template.estimatedCredits} credits, ${template.estimatedDuration}`,
      `Aspect ratio: ${template.aspectRatio}`,
      "",
      "Execution Plan:",
      ...plan,
      "",
      contextNotes.length > 0
        ? `Brand context:\n${contextNotes.map((n) => `   ${n}`).join("\n")}`
        : null,
      "",
      "Execute each step in order, passing outputs from earlier steps as inputs to later ones.",
      "You can adapt the template parameters based on the user's specific request.",
    ]
      .filter((s) => s !== null)
      .join("\n");

    return {
      success: true,
      content: summary,
      data: {
        templateId: template.id,
        templateName: template.name,
        steps: template.steps,
      },
    };
  }

  return {
    success: false,
    content: `Unknown action: ${action}. Use 'list' or 'execute'.`,
  };
};
