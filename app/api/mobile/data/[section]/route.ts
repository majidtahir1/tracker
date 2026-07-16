import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localToday } from "@/lib/dates";
import { getDashboardData } from "@/lib/queries/dashboard";
import { getWorkoutOverview, getSessionDetail, getHistory } from "@/lib/queries/workout";
import { getAnalyticsData, parseAnalyticsRange } from "@/lib/queries/analytics";
import { getExerciseLibrary } from "@/lib/queries/exercises";
import { getRecordsData } from "@/lib/queries/records";
import {
  getMeasurementsData,
  getNutritionData,
  getPhotosData,
  getRecoveryData,
} from "@/lib/queries/tracking";
import { getPrograms } from "@/lib/queries/programs";
import { shouldOnboard } from "@/lib/onboarding";
import { getStarterSummary } from "@/lib/onboarding-server";
import { isWhoopConfigured } from "@/lib/whoop/config";
import { isFitbitConfigured } from "@/lib/fitbit/config";
import { getGoalsPageData } from "@/lib/queries/goals";
import { getCalendarData, parseMonthParam } from "@/lib/queries/calendar";
import { getWhoopStatus } from "@/lib/queries/whoop";
import { getFitbitStatus } from "@/lib/queries/fitbit";
import { getLatestCoachBrief } from "@/lib/actions/dashboard-coach";
import { hasAiDataConsent } from "@/lib/ai/consent";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { section } = await params;
  const url = new URL(request.url);
  let data: unknown;
  switch (section) {
    case "dashboard": {
      const [dashboard, coachBrief] = await Promise.all([
        getDashboardData(),
        getLatestCoachBrief(),
      ]);
      data = { ...dashboard, coachBrief };
      break;
    }
    case "workout":
      data = await getWorkoutOverview(url.searchParams.get("templateId") ?? undefined);
      break;
    case "session": {
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "Session id is required" }, { status: 400 });
      data = await getSessionDetail(id);
      break;
    }
    case "history":
      data = await getHistory();
      break;
    case "analytics":
      data = await getAnalyticsData(parseAnalyticsRange(url.searchParams.get("range") ?? undefined));
      break;
    case "exercises":
      data = await getExerciseLibrary();
      break;
    case "records":
      data = await getRecordsData();
      break;
    case "recovery":
      data = await getRecoveryData(localToday());
      break;
    case "measurements":
      data = await getMeasurementsData();
      break;
    case "nutrition":
      data = await getNutritionData(localToday());
      break;
    case "photos":
      data = await getPhotosData();
      break;
    case "goals":
      data = await getGoalsPageData();
      break;
    case "calendar":
      data = await getCalendarData(
        parseMonthParam(url.searchParams.get("month") ?? undefined),
        url.searchParams.get("date"),
      );
      break;
    case "programs": {
      const [programs, aiConsent] = await Promise.all([
        getPrograms(),
        hasAiDataConsent(session.user.id),
      ]);
      data = {
        ...programs,
        aiConsent,
        aiConfigured: Boolean(process.env.MINIMAX_API_KEY),
      };
      break;
    }
    case "onboarding": {
      const [settings, completedCount, starter] = await Promise.all([
        prisma.appSettings.findUnique({ where: { userId: session.user.id } }),
        prisma.workoutSession.count({ where: { userId: session.user.id, status: "COMPLETED" } }),
        getStarterSummary(),
      ]);
      data = {
        shouldOnboard: shouldOnboard(settings, completedCount),
        activeProgramId: settings?.activeProgramId ?? null,
        starter,
        whoopConfigured: isWhoopConfigured(),
        fitbitConfigured: isFitbitConfigured(),
      };
      break;
    }
    case "settings": {
      const [settings, devices, whoop, fitbit] = await Promise.all([
        prisma.appSettings.findUnique({ where: { userId: session.user.id } }),
        prisma.pushToken.count({ where: { userId: session.user.id } }),
        getWhoopStatus(),
        getFitbitStatus(),
      ]);
      data = { settings, deviceRegistered: devices > 0, whoop, fitbit };
      break;
    }
    default:
      return Response.json({ error: "Unknown mobile data section" }, { status: 404 });
  }
  return Response.json({ data });
}
