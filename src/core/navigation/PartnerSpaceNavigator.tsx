import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PartnerSpaceRealtimeListener } from '@features/partner-space/components/PartnerSpaceRealtimeListener';
import { PartnerSpaceToast } from '@features/partner-space/components/PartnerSpaceToast';
import { usePartnerSpace } from '@features/partner-space/hooks/usePartnerSpace';
import { useDisappearingItemsProcessor } from '@features/partner-space/hooks/useDisappearingItems';

import SpaceHomeScreen from '@features/partner-space/screens/SpaceHomeScreen';
import PartnerCanvasScreen from '@features/partner-space/screens/PartnerCanvasScreen';
import WidgetPreviewScreen from '@features/partner-space/screens/WidgetPreviewScreen';
import PermissionsScreen from '@features/partner-space/screens/PermissionsScreen';
import HistoryScreen from '@features/partner-space/screens/HistoryScreen';
import ScheduledDropsScreen from '@features/partner-space/screens/ScheduledDropsScreen';
import SpaceSettingsScreen from '@features/partner-space/screens/SpaceSettingsScreen';

export type PartnerSpaceStackParamList = {
  SpaceHome: undefined;
  PartnerCanvas: undefined;
  WidgetPreview: undefined;
  SpacePermissions: undefined;
  SpaceHistory: undefined;
  ScheduledDrops: undefined;
  SpaceSettings: undefined;
};

const Stack = createNativeStackNavigator<PartnerSpaceStackParamList>();

/**
 * Partner Space stack navigator.
 * Contains all 8 Partner Space screens + the realtime listener.
 */
const PartnerSpaceNavigator: React.FC = () => {
  usePartnerSpace();
  useDisappearingItemsProcessor();

  return (
    <>
      <PartnerSpaceRealtimeListener />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="SpaceHome" component={SpaceHomeScreen} />
        <Stack.Screen name="PartnerCanvas" component={PartnerCanvasScreen} />
        <Stack.Screen name="WidgetPreview" component={WidgetPreviewScreen} />
        <Stack.Screen name="SpacePermissions" component={PermissionsScreen} />
        <Stack.Screen name="SpaceHistory" component={HistoryScreen} />
        <Stack.Screen name="ScheduledDrops" component={ScheduledDropsScreen} />
        <Stack.Screen name="SpaceSettings" component={SpaceSettingsScreen} />
      </Stack.Navigator>
      <PartnerSpaceToast />
    </>
  );
};

export { PartnerSpaceNavigator };
export default PartnerSpaceNavigator;
