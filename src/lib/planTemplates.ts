export type TemplateExercise = { name: string; sets: number; reps: number };
export type TemplateDay = { name: string; exercises: TemplateExercise[] };
export type PlanTemplate = {
  id: string;
  name: string;
  daysPerWeek: number;
  description: string;
  dayFocus: string[];
  days: TemplateDay[];
};

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: "ppl",
    name: "Push / Pull / Legs",
    daysPerWeek: 6,
    description:
      "Classic PPL repeated twice per week. High volume, hits every muscle twice. Best for intermediate to advanced lifters.",
    dayFocus: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"],
    days: [
      {
        name: "Push A",
        exercises: [
          { name: "Barbell Bench Press", sets: 4, reps: 6 },
          { name: "Overhead Press", sets: 3, reps: 8 },
          { name: "Incline Dumbbell Press", sets: 3, reps: 10 },
          { name: "Lateral Raise", sets: 3, reps: 12 },
          { name: "Tricep Pushdown", sets: 3, reps: 12 },
          { name: "Overhead Tricep Extension", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Pull A",
        exercises: [
          { name: "Pull-Up", sets: 4, reps: 8 },
          { name: "Barbell Row", sets: 4, reps: 8 },
          { name: "Lat Pulldown", sets: 3, reps: 10 },
          { name: "Seated Cable Row", sets: 3, reps: 10 },
          { name: "Face Pull", sets: 3, reps: 15 },
          { name: "Barbell Curl", sets: 3, reps: 10 },
        ],
      },
      {
        name: "Legs A",
        exercises: [
          { name: "Back Squat", sets: 4, reps: 6 },
          { name: "Romanian Deadlift", sets: 3, reps: 8 },
          { name: "Leg Press", sets: 3, reps: 10 },
          { name: "Leg Curl", sets: 3, reps: 12 },
          { name: "Calf Raise", sets: 4, reps: 15 },
        ],
      },
      {
        name: "Push B",
        exercises: [
          { name: "Incline Barbell Bench Press", sets: 4, reps: 8 },
          { name: "Seated Dumbbell Press", sets: 3, reps: 10 },
          { name: "Dumbbell Bench Press", sets: 3, reps: 10 },
          { name: "Cable Crossover", sets: 3, reps: 12 },
          { name: "Skull Crusher", sets: 3, reps: 10 },
          { name: "Tricep Pushdown", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Pull B",
        exercises: [
          { name: "Deadlift", sets: 3, reps: 5 },
          { name: "Lat Pulldown", sets: 4, reps: 10 },
          { name: "Dumbbell Row", sets: 3, reps: 10 },
          { name: "Straight Arm Pulldown", sets: 3, reps: 12 },
          { name: "Hammer Curl", sets: 3, reps: 10 },
          { name: "Incline Dumbbell Curl", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Legs B",
        exercises: [
          { name: "Front Squat", sets: 4, reps: 8 },
          { name: "Hip Thrust", sets: 3, reps: 10 },
          { name: "Walking Lunge", sets: 3, reps: 10 },
          { name: "Leg Extension", sets: 3, reps: 12 },
          { name: "Leg Curl", sets: 3, reps: 12 },
          { name: "Calf Raise", sets: 4, reps: 15 },
        ],
      },
    ],
  },
  {
    id: "upper-lower",
    name: "Upper / Lower",
    daysPerWeek: 4,
    description:
      "Two upper and two lower days. Balanced and efficient — great for solid results with a moderate time commitment.",
    dayFocus: ["Upper", "Lower", "Upper", "Lower"],
    days: [
      {
        name: "Upper Heavy",
        exercises: [
          { name: "Barbell Bench Press", sets: 4, reps: 6 },
          { name: "Barbell Row", sets: 4, reps: 6 },
          { name: "Overhead Press", sets: 3, reps: 8 },
          { name: "Lat Pulldown", sets: 3, reps: 10 },
          { name: "Barbell Curl", sets: 3, reps: 10 },
          { name: "Skull Crusher", sets: 3, reps: 10 },
        ],
      },
      {
        name: "Lower Heavy",
        exercises: [
          { name: "Back Squat", sets: 4, reps: 6 },
          { name: "Romanian Deadlift", sets: 4, reps: 8 },
          { name: "Leg Press", sets: 3, reps: 10 },
          { name: "Leg Curl", sets: 3, reps: 10 },
          { name: "Calf Raise", sets: 4, reps: 12 },
          { name: "Plank", sets: 3, reps: 10 },
        ],
      },
      {
        name: "Upper Light",
        exercises: [
          { name: "Incline Dumbbell Press", sets: 4, reps: 10 },
          { name: "Seated Cable Row", sets: 4, reps: 10 },
          { name: "Lateral Raise", sets: 3, reps: 12 },
          { name: "Face Pull", sets: 3, reps: 15 },
          { name: "Hammer Curl", sets: 3, reps: 12 },
          { name: "Tricep Pushdown", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Lower Light",
        exercises: [
          { name: "Front Squat", sets: 3, reps: 10 },
          { name: "Hip Thrust", sets: 3, reps: 10 },
          { name: "Walking Lunge", sets: 3, reps: 10 },
          { name: "Leg Extension", sets: 3, reps: 12 },
          { name: "Calf Raise", sets: 4, reps: 15 },
          { name: "Hanging Leg Raise", sets: 3, reps: 12 },
        ],
      },
    ],
  },
  {
    id: "bro-split",
    name: "Bro Split",
    daysPerWeek: 5,
    description:
      "One muscle group per day — high volume per muscle with full recovery. Popular with bodybuilders.",
    dayFocus: ["Chest", "Back", "Shoulders", "Legs", "Arms"],
    days: [
      {
        name: "Chest",
        exercises: [
          { name: "Barbell Bench Press", sets: 4, reps: 8 },
          { name: "Incline Dumbbell Press", sets: 4, reps: 10 },
          { name: "Machine Chest Press", sets: 3, reps: 10 },
          { name: "Cable Crossover", sets: 3, reps: 12 },
          { name: "Dumbbell Fly", sets: 3, reps: 12 },
          { name: "Push-Up", sets: 3, reps: 15 },
        ],
      },
      {
        name: "Back",
        exercises: [
          { name: "Pull-Up", sets: 4, reps: 8 },
          { name: "Barbell Row", sets: 4, reps: 8 },
          { name: "Lat Pulldown", sets: 3, reps: 10 },
          { name: "Seated Cable Row", sets: 3, reps: 10 },
          { name: "Straight Arm Pulldown", sets: 3, reps: 12 },
          { name: "Face Pull", sets: 3, reps: 15 },
        ],
      },
      {
        name: "Shoulders",
        exercises: [
          { name: "Overhead Press", sets: 4, reps: 8 },
          { name: "Seated Dumbbell Press", sets: 3, reps: 10 },
          { name: "Lateral Raise", sets: 4, reps: 12 },
          { name: "Rear Delt Fly", sets: 3, reps: 12 },
          { name: "Front Raise", sets: 3, reps: 12 },
          { name: "Shrug", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Legs",
        exercises: [
          { name: "Back Squat", sets: 4, reps: 8 },
          { name: "Leg Press", sets: 4, reps: 10 },
          { name: "Romanian Deadlift", sets: 3, reps: 10 },
          { name: "Leg Curl", sets: 3, reps: 12 },
          { name: "Leg Extension", sets: 3, reps: 12 },
          { name: "Calf Raise", sets: 4, reps: 15 },
        ],
      },
      {
        name: "Arms",
        exercises: [
          { name: "Barbell Curl", sets: 4, reps: 10 },
          { name: "Skull Crusher", sets: 4, reps: 10 },
          { name: "Hammer Curl", sets: 3, reps: 12 },
          { name: "Tricep Pushdown", sets: 3, reps: 12 },
          { name: "Preacher Curl", sets: 3, reps: 12 },
          { name: "Overhead Tricep Extension", sets: 3, reps: 12 },
        ],
      },
    ],
  },
  {
    id: "full-body",
    name: "Full Body",
    daysPerWeek: 3,
    description:
      "Three full-body sessions per week. Best for beginners or anyone with limited gym time who wants balanced training.",
    dayFocus: ["Full Body", "Full Body", "Full Body"],
    days: [
      {
        name: "Day A",
        exercises: [
          { name: "Back Squat", sets: 3, reps: 8 },
          { name: "Barbell Bench Press", sets: 3, reps: 8 },
          { name: "Barbell Row", sets: 3, reps: 8 },
          { name: "Overhead Press", sets: 3, reps: 10 },
          { name: "Plank", sets: 3, reps: 10 },
        ],
      },
      {
        name: "Day B",
        exercises: [
          { name: "Deadlift", sets: 3, reps: 5 },
          { name: "Incline Dumbbell Press", sets: 3, reps: 10 },
          { name: "Lat Pulldown", sets: 3, reps: 10 },
          { name: "Lateral Raise", sets: 3, reps: 12 },
          { name: "Hanging Leg Raise", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Day C",
        exercises: [
          { name: "Front Squat", sets: 3, reps: 8 },
          { name: "Dumbbell Bench Press", sets: 3, reps: 10 },
          { name: "Seated Cable Row", sets: 3, reps: 10 },
          { name: "Barbell Curl", sets: 3, reps: 10 },
          { name: "Tricep Pushdown", sets: 3, reps: 12 },
          { name: "Calf Raise", sets: 3, reps: 15 },
        ],
      },
    ],
  },
  {
    id: "phul",
    name: "Power & Hypertrophy (PHUL)",
    daysPerWeek: 4,
    description:
      "Two heavy days for strength, two moderate days for size. Good for someone who wants both strength and muscle growth.",
    dayFocus: ["Upper Heavy", "Lower Heavy", "Upper Hyper", "Lower Hyper"],
    days: [
      {
        name: "Upper Heavy",
        exercises: [
          { name: "Barbell Bench Press", sets: 4, reps: 5 },
          { name: "Barbell Row", sets: 4, reps: 5 },
          { name: "Overhead Press", sets: 3, reps: 6 },
          { name: "Pull-Up", sets: 3, reps: 6 },
          { name: "Skull Crusher", sets: 3, reps: 8 },
          { name: "Barbell Curl", sets: 3, reps: 8 },
        ],
      },
      {
        name: "Lower Heavy",
        exercises: [
          { name: "Back Squat", sets: 4, reps: 5 },
          { name: "Deadlift", sets: 3, reps: 5 },
          { name: "Leg Press", sets: 3, reps: 8 },
          { name: "Leg Curl", sets: 3, reps: 8 },
          { name: "Calf Raise", sets: 4, reps: 10 },
        ],
      },
      {
        name: "Upper Hypertrophy",
        exercises: [
          { name: "Incline Dumbbell Press", sets: 4, reps: 10 },
          { name: "Seated Cable Row", sets: 4, reps: 10 },
          { name: "Lateral Raise", sets: 3, reps: 12 },
          { name: "Cable Crossover", sets: 3, reps: 12 },
          { name: "Hammer Curl", sets: 3, reps: 12 },
          { name: "Tricep Pushdown", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Lower Hypertrophy",
        exercises: [
          { name: "Front Squat", sets: 3, reps: 10 },
          { name: "Romanian Deadlift", sets: 3, reps: 10 },
          { name: "Walking Lunge", sets: 3, reps: 10 },
          { name: "Leg Extension", sets: 3, reps: 12 },
          { name: "Leg Curl", sets: 3, reps: 12 },
          { name: "Calf Raise", sets: 4, reps: 15 },
        ],
      },
    ],
  },
];

export function getTemplate(id: string) {
  return PLAN_TEMPLATES.find((t) => t.id === id);
}
