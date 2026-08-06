import { useState } from "react";
import "./App.css";
import { DayRangeSelector } from "./components/DayRangeSelector";
import { SummarySection } from "./components/SummarySection";
import { VolumeByMuscleChart } from "./components/VolumeByMuscleChart";
import { MeasurementsSection } from "./components/MeasurementsSection";
import { ExerciseExplorer } from "./components/ExerciseExplorer";

function App() {
  const [days, setDays] = useState(90);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Augmented Hevy</h1>
        <DayRangeSelector days={days} onChange={setDays} />
      </header>

      <main className="app-grid">
        <SummarySection days={days} />
        <VolumeByMuscleChart days={days} />
        <MeasurementsSection />
        <ExerciseExplorer />
      </main>
    </div>
  );
}

export default App;
