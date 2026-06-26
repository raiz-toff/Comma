/**
 * usePlatformContext — resolves everything the app needs to adapt its UI
 * to a given gig platform: the full PlatformDef, the OperationalModelDef
 * it links to, and the effective merged terminology.
 *
 * Usage:
 *   const { platform, model, terminology } = usePlatformContext("doordash");
 *   // terminology.driverTerm → "Dasher"  (DoorDash override of model default)
 *   // model.revenueFields    → [grossRevenue, tipsRevenue, bonusRevenue]
 *   // model.hasTips          → true
 *   // model.supportsCashPayments → false
 */

import { useMemo } from "react";
import { getPlatformDef } from "@/src/registry/platforms/index";
import { getOperationalModel, resolveTerminology } from "@/src/registry/operationalModels/index";
import { type PlatformDef } from "@/src/registry/platforms/types";
import { type OperationalModelDef, type RevenueFieldDef } from "@/src/registry/operationalModels/index";

export interface PlatformContext {
  /** Full platform definition from the registry */
  platform: PlatformDef;
  /** The operational model that describes how this platform works */
  model: OperationalModelDef;
  /** Merged terminology — platform overrides take priority over model defaults */
  terminology: {
    driverTerm: string;
    sessionTerm: string;
    tripTerm: string;
  };
  /** Revenue fields to render on the shift-logging form */
  revenueFields: RevenueFieldDef[];
  /** Quick flags derived from the model */
  flags: {
    hasTips: boolean;
    hasSurge: boolean;
    supportsCashPayments: boolean;
    tracksMileage: boolean;
    mileageReimbursedByPlatform: boolean;
    driverSetsPricing: boolean;
    platformIssuesTaxForm: boolean;
  };
}

export function usePlatformContext(platformId: string): PlatformContext {
  return useMemo(() => {
    const platform = getPlatformDef(platformId);
    const model = getOperationalModel(platform.operationalModel);
    const terminology = resolveTerminology(model, platform.terminology);

    return {
      platform,
      model,
      terminology,
      revenueFields: model.revenueFields,
      flags: {
        hasTips: model.hasTips,
        hasSurge: model.hasSurge,
        supportsCashPayments: model.supportsCashPayments,
        tracksMileage: model.tracksMileage,
        mileageReimbursedByPlatform: model.mileageReimbursedByPlatform,
        driverSetsPricing: model.driverSetsPricing,
        platformIssuesTaxForm: model.platformIssuesTaxForm,
      },
    };
  }, [platformId]);
}
