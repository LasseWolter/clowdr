import React from "react";
import type { Permissions_Permission_Enum } from "../../generated/graphql";
import { useConferenceCurrentUserActivePermissions } from "./useConferenceCurrentUserActivePermissions";

export default function RequireAtLeastOnePermissionWrapper({
    children,
    permissions,
    componentIfDenied,
}: {
    children: React.ReactNode | React.ReactNodeArray;
    permissions?: Array<Permissions_Permission_Enum>;
    componentIfDenied?: JSX.Element;
}): JSX.Element | null {
    const activePermissions = useConferenceCurrentUserActivePermissions();

    if (!permissions || permissions.some((permission) => activePermissions.has(permission))) {
        return <>{children}</>;
    }

    return componentIfDenied ?? null;
}
