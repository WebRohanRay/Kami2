package com.rohanray12345.Kami.widget;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class PartnerSpaceWidgetModule extends ReactContextBaseJavaModule {
  public PartnerSpaceWidgetModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return "PartnerSpaceWidget";
  }

  @ReactMethod
  public void updateWidget(String stateJson, Promise promise) {
    try {
      Context context = getReactApplicationContext();
      SharedPreferences prefs = context.getSharedPreferences(
        PartnerSpaceWidgetProvider.PREFS_NAME,
        Context.MODE_PRIVATE
      );
      prefs.edit().putString(PartnerSpaceWidgetProvider.STATE_KEY, stateJson).apply();
      PartnerSpaceWidgetProvider.updateAllWidgets(context);
      promise.resolve(true);
    } catch (Exception e) {
      promise.reject("PARTNER_SPACE_WIDGET_UPDATE_FAILED", e);
    }
  }
}
