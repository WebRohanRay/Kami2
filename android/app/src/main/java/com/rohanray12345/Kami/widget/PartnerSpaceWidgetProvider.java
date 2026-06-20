package com.rohanray12345.Kami.widget;

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

import com.rohanray12345.Kami.MainActivity;
import com.rohanray12345.Kami.R;

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
