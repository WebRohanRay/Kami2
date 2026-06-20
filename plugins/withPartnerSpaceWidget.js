const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WIDGET_PACKAGE_SEGMENT = 'widget';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(file, contents) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, contents);
}

function getPackagePath(androidPackage) {
  return androidPackage.split('.').join(path.sep);
}

function addWidgetReceiver(androidManifest, androidPackage) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  app.receiver = app.receiver || [];

  const receiverName = `.${WIDGET_PACKAGE_SEGMENT}.PartnerSpaceWidgetProvider`;
  const exists = app.receiver.some((receiver) => receiver.$?.['android:name'] === receiverName);
  if (exists) return androidManifest;

  app.receiver.push({
    $: {
      'android:name': receiverName,
      'android:exported': 'true',
      'android:label': 'Partner Space',
    },
    'intent-filter': [
      {
        action: [
          {
            $: {
              'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
            },
          },
        ],
      },
    ],
    'meta-data': [
      {
        $: {
          'android:name': 'android.appwidget.provider',
          'android:resource': '@xml/partner_space_widget_info',
        },
      },
    ],
  });

  return androidManifest;
}

function patchMainApplication(androidProjectRoot, androidPackage) {
  const packagePath = getPackagePath(androidPackage);
  const mainApplicationKt = path.join(
    androidProjectRoot,
    'app',
    'src',
    'main',
    'java',
    packagePath,
    'MainApplication.kt'
  );
  const mainApplicationJava = path.join(
    androidProjectRoot,
    'app',
    'src',
    'main',
    'java',
    packagePath,
    'MainApplication.java'
  );

  const target = fs.existsSync(mainApplicationKt) ? mainApplicationKt : mainApplicationJava;
  if (!fs.existsSync(target)) return;

  let source = fs.readFileSync(target, 'utf8');
  const importLine = `import ${androidPackage}.${WIDGET_PACKAGE_SEGMENT}.PartnerSpaceWidgetPackage`;
  if (!source.includes(importLine)) {
    const resolvedImport = target.endsWith('.java') ? `${importLine};` : importLine;
    source = source.replace(/^package .+$/m, (line) => `${line}\n\n${resolvedImport}`);
  }

  if (!source.includes('PartnerSpaceWidgetPackage()')) {
    if (target.endsWith('.kt')) {
      source = source.replace(
        /(val packages = PackageList\(this\)\.packages\s*)/,
        `$1\n            packages.add(PartnerSpaceWidgetPackage())\n`
      );
      source = source.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{\s*)/,
        `$1\n              add(PartnerSpaceWidgetPackage())\n`
      );
    } else {
      source = source.replace(
        /(List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);\s*)/,
        `$1\n          packages.add(new PartnerSpaceWidgetPackage());`
      );
    }
  }

  fs.writeFileSync(target, source);
}

function createProviderJava(androidPackage) {
  return `package ${androidPackage}.${WIDGET_PACKAGE_SEGMENT};

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import ${androidPackage}.MainActivity;
import ${androidPackage}.R;

public class PartnerSpaceWidgetProvider extends AppWidgetProvider {
  static final String PREFS_NAME = "partner_space_widget";
  static final String STATE_KEY = "state";

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    for (int appWidgetId : appWidgetIds) {
      updateWidget(context, manager, appWidgetId);
    }
  }

  public static void updateAllWidgets(Context context) {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    ComponentName component = new ComponentName(context, PartnerSpaceWidgetProvider.class);
    int[] ids = manager.getAppWidgetIds(component);
    for (int id : ids) {
      updateWidget(context, manager, id);
    }
  }

  private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.partner_space_widget);
    JSONObject state = readState(context);
    String nickname = state.optString("nickname", "Our Wall");
    String mood = state.optString("mood", "afternoon");
    boolean goodnightActive = state.optBoolean("goodnightActive", false);
    boolean hasNewUpdate = state.optBoolean("hasNewUpdate", false);
    JSONArray items = state.optJSONArray("items");

    views.setTextViewText(R.id.partner_space_widget_title, nickname);
    views.setTextViewText(R.id.partner_space_widget_subtitle, subtitleForState(state, items));
    views.setInt(R.id.partner_space_widget_root, "setBackgroundResource", backgroundForMood(mood, goodnightActive));
    views.setViewVisibility(R.id.partner_space_widget_dot, hasNewUpdate ? View.VISIBLE : View.GONE);

    int[] itemIds = new int[] {
      R.id.partner_space_widget_item_1,
      R.id.partner_space_widget_item_2,
      R.id.partner_space_widget_item_3,
      R.id.partner_space_widget_item_4,
      R.id.partner_space_widget_item_5
    };

    for (int i = 0; i < itemIds.length; i++) {
      if (items != null && i < items.length()) {
        JSONObject item = items.optJSONObject(i);
        views.setViewVisibility(itemIds[i], View.VISIBLE);
        views.setTextViewText(itemIds[i], labelForItem(item));
        views.setTextColor(itemIds[i], textColorForItem(item));
        views.setInt(itemIds[i], "setBackgroundResource", backgroundForItem(item));
      } else {
        views.setViewVisibility(itemIds[i], View.GONE);
      }
    }

    if (goodnightActive) {
      String message = state.optString("goodnightMessage", "Sweet dreams");
      views.setTextViewText(R.id.partner_space_widget_footer, "Goodnight mode: " + message);
    } else if (items == null || items.length() == 0) {
      views.setTextViewText(R.id.partner_space_widget_footer, "Tap to open Partner Space");
    } else {
      views.setTextViewText(R.id.partner_space_widget_footer, "Tap to open");
    }

    views.setOnClickPendingIntent(R.id.partner_space_widget_root, openAppIntent(context, "kami://partner-space"));
    views.setOnClickPendingIntent(R.id.partner_space_widget_add, openAppIntent(context, "kami://partner-space/compose"));
    manager.updateAppWidget(appWidgetId, views);
  }

  private static JSONObject readState(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    String raw = prefs.getString(STATE_KEY, "{}");
    try {
      return new JSONObject(raw == null ? "{}" : raw);
    } catch (Exception ignored) {
      return new JSONObject();
    }
  }

  private static PendingIntent openAppIntent(Context context, String uri) {
    Intent intent = new Intent(context, MainActivity.class);
    intent.setAction(Intent.ACTION_VIEW);
    intent.setData(Uri.parse(uri));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getActivity(context, uri.hashCode(), intent, flags);
  }

  private static String subtitleForState(JSONObject state, JSONArray items) {
    String presence = state.optString("presence", "");
    if (presence.length() > 0) return presence;
    if (items == null || items.length() == 0) return "A quiet corner for the two of you";
    return items.length() + " little thing" + (items.length() == 1 ? "" : "s") + " here";
  }

  private static String labelForItem(JSONObject item) {
    if (item == null) return "";
    String type = item.optString("type", "note");
    JSONObject content = item.optJSONObject("content");
    if ("note".equals(type)) {
      String text = content == null ? "" : content.optString("text", "");
      return text.length() == 0 ? "Note" : text;
    }
    if ("sticker".equals(type)) {
      String sticker = content == null ? "" : content.optString("stickerSource", "");
      return sticker.length() == 0 ? "Sticker" : sticker;
    }
    if ("photo".equals(type)) return "Photo";
    if ("gift".equals(type)) return item.optBoolean("isGiftOpened", false) ? "Opened gift" : "Gift";
    if ("drawing".equals(type)) return "Drawing";
    return "Item";
  }

  private static int textColorForItem(JSONObject item) {
    if (item == null) return Color.rgb(62, 39, 35);
    String type = item.optString("type", "");
    if ("sticker".equals(type)) return Color.rgb(62, 39, 35);
    return Color.rgb(62, 39, 35);
  }

  private static int backgroundForItem(JSONObject item) {
    if (item == null) return R.drawable.partner_space_widget_note_yellow;
    String type = item.optString("type", "note");
    if ("photo".equals(type)) return R.drawable.partner_space_widget_polaroid;
    if ("gift".equals(type)) return R.drawable.partner_space_widget_gift;
    if ("sticker".equals(type)) return R.drawable.partner_space_widget_sticker;

    JSONObject content = item.optJSONObject("content");
    String color = content == null ? "yellow" : content.optString("color", "yellow");
    if ("pink".equals(color)) return R.drawable.partner_space_widget_note_pink;
    if ("blue".equals(color)) return R.drawable.partner_space_widget_note_blue;
    if ("lavender".equals(color)) return R.drawable.partner_space_widget_note_lavender;
    if ("white".equals(color)) return R.drawable.partner_space_widget_note_white;
    return R.drawable.partner_space_widget_note_yellow;
  }

  private static int backgroundForMood(String mood, boolean goodnightActive) {
    if (goodnightActive || "night".equals(mood)) return R.drawable.partner_space_widget_bg_night;
    if ("morning".equals(mood)) return R.drawable.partner_space_widget_bg_morning;
    if ("evening".equals(mood)) return R.drawable.partner_space_widget_bg_evening;
    return R.drawable.partner_space_widget_bg_day;
  }
}
`;
}

function createModuleJava(androidPackage) {
  return `package ${androidPackage}.${WIDGET_PACKAGE_SEGMENT};

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
`;
}

function createPackageJava(androidPackage) {
  return `package ${androidPackage}.${WIDGET_PACKAGE_SEGMENT};

import androidx.annotation.NonNull;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class PartnerSpaceWidgetPackage implements ReactPackage {
  @NonNull
  @Override
  public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new PartnerSpaceWidgetModule(reactContext));
    return modules;
  }

  @NonNull
  @Override
  public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
`;
}

function writeNativeFiles(androidProjectRoot, androidPackage) {
  const packagePath = getPackagePath(androidPackage);
  const javaRoot = path.join(androidProjectRoot, 'app', 'src', 'main', 'java', packagePath, WIDGET_PACKAGE_SEGMENT);
  const resRoot = path.join(androidProjectRoot, 'app', 'src', 'main', 'res');

  writeFile(path.join(javaRoot, 'PartnerSpaceWidgetProvider.java'), createProviderJava(androidPackage));
  writeFile(path.join(javaRoot, 'PartnerSpaceWidgetModule.java'), createModuleJava(androidPackage));
  writeFile(path.join(javaRoot, 'PartnerSpaceWidgetPackage.java'), createPackageJava(androidPackage));

  writeFile(path.join(resRoot, 'xml', 'partner_space_widget_info.xml'), `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/partner_space_widget_description"
  android:initialLayout="@layout/partner_space_widget"
  android:minWidth="110dp"
  android:minHeight="110dp"
  android:targetCellWidth="2"
  android:targetCellHeight="2"
  android:minResizeWidth="110dp"
  android:minResizeHeight="110dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="1800000"
  android:widgetCategory="home_screen" />
`);

  writeFile(path.join(resRoot, 'layout', 'partner_space_widget.xml'), `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/partner_space_widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:padding="10dp"
  android:background="@drawable/partner_space_widget_bg_day">

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">

    <LinearLayout
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:gravity="center_vertical"
      android:orientation="horizontal">

      <TextView
        android:id="@+id/partner_space_widget_title"
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:layout_weight="1"
        android:ellipsize="end"
        android:maxLines="1"
        android:text="Our Wall"
        android:textColor="#3E2723"
        android:textSize="15sp"
        android:textStyle="bold" />

      <TextView
        android:id="@+id/partner_space_widget_dot"
        android:layout_width="10dp"
        android:layout_height="10dp"
        android:background="@drawable/partner_space_widget_dot"
        android:text="" />
    </LinearLayout>

    <TextView
      android:id="@+id/partner_space_widget_subtitle"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:ellipsize="end"
      android:maxLines="1"
      android:text="A quiet corner for the two of you"
      android:textColor="#6D4C41"
      android:textSize="11sp" />

    <LinearLayout
      android:layout_width="match_parent"
      android:layout_height="0dp"
      android:layout_weight="1"
      android:gravity="center"
      android:orientation="vertical">

      <TextView
        android:id="@+id/partner_space_widget_item_1"
        style="@style/PartnerSpaceWidgetItem"
        android:rotation="-2" />

      <TextView
        android:id="@+id/partner_space_widget_item_2"
        style="@style/PartnerSpaceWidgetItem"
        android:rotation="2" />

      <TextView
        android:id="@+id/partner_space_widget_item_3"
        style="@style/PartnerSpaceWidgetItem"
        android:rotation="-1" />

      <TextView
        android:id="@+id/partner_space_widget_item_4"
        style="@style/PartnerSpaceWidgetItem"
        android:rotation="1" />

      <TextView
        android:id="@+id/partner_space_widget_item_5"
        style="@style/PartnerSpaceWidgetItem"
        android:rotation="-2" />
    </LinearLayout>

    <LinearLayout
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:gravity="center_vertical"
      android:orientation="horizontal">

      <TextView
        android:id="@+id/partner_space_widget_footer"
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:layout_weight="1"
        android:ellipsize="end"
        android:maxLines="1"
        android:text="Tap to open"
        android:textColor="#5D4037"
        android:textSize="10sp" />

      <TextView
        android:id="@+id/partner_space_widget_add"
        android:layout_width="28dp"
        android:layout_height="28dp"
        android:background="@drawable/partner_space_widget_add"
        android:gravity="center"
        android:text="+"
        android:textColor="#FFFFFF"
        android:textSize="20sp"
        android:textStyle="bold" />
    </LinearLayout>
  </LinearLayout>
</FrameLayout>
`);

  writeFile(path.join(resRoot, 'values', 'partner_space_widget_styles.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="partner_space_widget_description">A Partner Space home screen widget.</string>

  <style name="PartnerSpaceWidgetItem">
    <item name="android:layout_width">match_parent</item>
    <item name="android:layout_height">wrap_content</item>
    <item name="android:layout_marginTop">3dp</item>
    <item name="android:layout_marginBottom">3dp</item>
    <item name="android:ellipsize">end</item>
    <item name="android:gravity">center</item>
    <item name="android:maxLines">1</item>
    <item name="android:paddingLeft">8dp</item>
    <item name="android:paddingRight">8dp</item>
    <item name="android:paddingTop">5dp</item>
    <item name="android:paddingBottom">5dp</item>
    <item name="android:textColor">#3E2723</item>
    <item name="android:textSize">12sp</item>
    <item name="android:background">@drawable/partner_space_widget_note_yellow</item>
  </style>
</resources>
`);

  const drawables = {
    partner_space_widget_bg_day: ['#D4A574', '#E8C9A0', '#8B6914'],
    partner_space_widget_bg_morning: ['#E5B875', '#FFE1A6', '#B07D2C'],
    partner_space_widget_bg_evening: ['#C47A69', '#F0B08B', '#8A4B3E'],
    partner_space_widget_bg_night: ['#2D1830', '#4A2040', '#7C4B68'],
    partner_space_widget_note_yellow: ['#FFF9C4', '#FFF3A1', '#E0C867'],
    partner_space_widget_note_pink: ['#FFD6DE', '#FFC0CD', '#DD8EA0'],
    partner_space_widget_note_blue: ['#BBDEFB', '#A7D1F4', '#7DAFD7'],
    partner_space_widget_note_lavender: ['#E8DAEF', '#DAC3E6', '#B39BC4'],
    partner_space_widget_note_white: ['#FFFFFF', '#F7F4EF', '#DDD6CC'],
    partner_space_widget_polaroid: ['#FFFFFF', '#F5F1EA', '#D8D0C5'],
    partner_space_widget_gift: ['#FFE4EC', '#FF9DB2', '#D95D79'],
    partner_space_widget_sticker: ['#FFFDF7', '#FFF7D7', '#E6D695'],
  };

  Object.entries(drawables).forEach(([name, colors]) => {
    writeFile(path.join(resRoot, 'drawable', `${name}.xml`), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <gradient android:startColor="${colors[0]}" android:endColor="${colors[1]}" android:angle="270" />
  <stroke android:width="1dp" android:color="${colors[2]}" />
  <corners android:radius="12dp" />
</shape>
`);
  });

  writeFile(path.join(resRoot, 'drawable', 'partner_space_widget_add.xml'), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval">
  <solid android:color="#D96B83" />
</shape>
`);

  writeFile(path.join(resRoot, 'drawable', 'partner_space_widget_dot.xml'), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval">
  <solid android:color="#D96B83" />
</shape>
`);
}

module.exports = function withPartnerSpaceWidget(config) {
  config = withAndroidManifest(config, (mod) => {
    const androidPackage = config.android?.package;
    if (!androidPackage) {
      throw new Error('Partner Space widget requires expo.android.package in app.config.js');
    }
    mod.modResults = addWidgetReceiver(mod.modResults, androidPackage);
    return mod;
  });

  config = withDangerousMod(config, [
    'android',
    async (mod) => {
      const androidPackage = config.android?.package;
      if (!androidPackage) {
        throw new Error('Partner Space widget requires expo.android.package in app.config.js');
      }
      writeNativeFiles(mod.modRequest.platformProjectRoot, androidPackage);
      patchMainApplication(mod.modRequest.platformProjectRoot, androidPackage);
      return mod;
    },
  ]);

  return config;
};
