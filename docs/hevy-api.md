# Hevy API Docs

> **Version:** 0.0.1  
> **Source:** <https://api.hevyapp.com/docs/>  
> **OpenAPI:** 3.0.0

Welcome to Hevy's public API! We're just starting to roll this out and depending on your feedback, we'll be adding more features and endpoints. Also, we make no guarantees that we won't completely change the structure or abandon the project entirely so use it at your own risk. Currently, this API is only available to Hevy Pro users. You can get your key on our web app at https://hevy.com/settings?developer. If you have any questions, please reach out to pedro@hevyapp.com 🤝.

All endpoints require an `api-key` header (string, uuid format). Get yours at <https://hevy.com/settings?developer>.

## Table of contents

- **Workouts**
  - `GET /v1/workouts` — Get a paginated list of workouts
  - `POST /v1/workouts` — Create a new workout
  - `GET /v1/workouts/count` — Get the total number of workouts on the account
  - `GET /v1/workouts/events` — Retrieve a paged list of workout events (updates or deletes) since a given date. Events are ordered from newest to oldest. The intention is to allow clients to keep their local cache of workouts up to date without having to fetch the entire list of workouts.
  - `GET /v1/workouts/{workoutId}` — Get a single workout’s complete details by the workoutId
  - `PUT /v1/workouts/{workoutId}` — Update an existing workout
- **Users**
  - `GET /v1/user/info` — Get user info
- **Routines**
  - `GET /v1/routines` — Get a paginated list of routines
  - `POST /v1/routines` — Create a new routine
  - `GET /v1/routines/{routineId}` — Get a routine by its Id
  - `PUT /v1/routines/{routineId}` — Update an existing routine
- **ExerciseTemplates**
  - `GET /v1/exercise_templates` — Get a paginated list of exercise templates available on the account.
  - `POST /v1/exercise_templates` — Create a new custom exercise template.
  - `GET /v1/exercise_templates/{exerciseTemplateId}` — Get a single exercise template by id.
- **RoutineFolders**
  - `GET /v1/routine_folders` — Get a paginated list of routine folders available on the account.
  - `POST /v1/routine_folders` — Create a new routine folder. The folder will be created at index 0, and all other folders will have their indexes incremented.
  - `GET /v1/routine_folders/{folderId}` — Get a single routine folder by id.
- **ExerciseHistory**
  - `GET /v1/exercise_history/{exerciseTemplateId}` — Get exercise history for a specific exercise template
- **Measurements**
  - `GET /v1/body_measurements` — Get a paginated list of body measurements for the authenticated user
  - `POST /v1/body_measurements` — Create a body measurement entry for a given date. Returns 409 if an entry already exists for that date.
  - `GET /v1/body_measurements/{date}` — Get a single body measurement by date
  - `PUT /v1/body_measurements/{date}` — Update an existing body measurement entry for a given date. All fields are overwritten; omitted fields are set to null.
- [Schemas](#schemas)

---

## Workouts

### `GET /v1/workouts`

Get a paginated list of workouts

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| query | `page` | integer | No | `1` | Page number (Must be 1 or greater) |
| query | `pageSize` | integer | No | `5` | Number of items on the requested page (Max 10) |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | A paginated list of workouts | object |
| 400 | Invalid page size | — |

### `POST /v1/workouts`

Create a new workout

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |

**Request body** (required): [`PostWorkoutsRequestBody`](#postworkoutsrequestbody)

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 201 | The workout was successfully created | [`Workout`](#workout) |
| 400 | Invalid request body | object |

### `GET /v1/workouts/count`

Get the total number of workouts on the account

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | The total count of workouts | object |

### `GET /v1/workouts/events`

Retrieve a paged list of workout events (updates or deletes) since a given date. Events are ordered from newest to oldest. The intention is to allow clients to keep their local cache of workouts up to date without having to fetch the entire list of workouts.

Returns a paginated array of workout events, indicating updates or deletions.

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| query | `page` | integer | No | `1` | Page number (Must be 1 or greater) |
| query | `pageSize` | integer | No | `5` | Number of items on the requested page (Max 10) |
| query | `since` | string | No | `1970-01-01T00:00:00Z` |  |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | A paginated list of workout events | [`PaginatedWorkoutEvents`](#paginatedworkoutevents) |
| 500 | Internal Server Error | — |

### `GET /v1/workouts/{workoutId}`

Get a single workout’s complete details by the workoutId

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| path | `workoutId` |  | Yes | — | The id of the workout |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | Success | [`Workout`](#workout) |
| 404 | Workout not found | — |

### `PUT /v1/workouts/{workoutId}`

Update an existing workout

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| path | `workoutId` |  | Yes | — | The id of the workout |

**Request body** (required): [`PostWorkoutsRequestBody`](#postworkoutsrequestbody)

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | The workout was successfully updated | [`Workout`](#workout) |
| 400 | Invalid request body | object |

## Users

### `GET /v1/user/info`

Get user info

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | The authenticated user's info | [`UserInfoResponse`](#userinforesponse) |
| 404 | User not found | — |

## Routines

### `GET /v1/routines`

Get a paginated list of routines

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| query | `page` | integer | No | `1` | Page number (Must be 1 or greater) |
| query | `pageSize` | integer | No | `5` | Number of items on the requested page (Max 10) |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | A paginated list of routines | object |
| 400 | Invalid page size | — |

### `POST /v1/routines`

Create a new routine

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |

**Request body** (required): [`PostRoutinesRequestBody`](#postroutinesrequestbody)

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 201 | The routine was successfully created | [`Routine`](#routine) |
| 400 | Invalid request body | object |
| 403 | Routine limit exceeded | object |

### `GET /v1/routines/{routineId}`

Get a routine by its Id

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| path | `routineId` |  | Yes | — | The id of the routine |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | The routine with the provided id | object |
| 400 | Invalid request body | object |

### `PUT /v1/routines/{routineId}`

Update an existing routine

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| path | `routineId` |  | Yes | — | The id of the routine |

**Request body** (required): [`PutRoutinesRequestBody`](#putroutinesrequestbody)

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | The routine was successfully updated | [`Routine`](#routine) |
| 400 | Invalid request body | object |
| 404 | Routine doesn't exist or doesn't belong to the user | object |

## ExerciseTemplates

### `GET /v1/exercise_templates`

Get a paginated list of exercise templates available on the account.

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| query | `page` | integer | No | `1` | Page number (Must be 1 or greater) |
| query | `pageSize` | integer | No | `5` | Number of items on the requested page (Max 100) |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | A paginated list of exercise templates | object |
| 400 | Invalid page size | — |

### `POST /v1/exercise_templates`

Create a new custom exercise template.

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |

**Request body** (required): [`CreateCustomExerciseRequestBody`](#createcustomexerciserequestbody)

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | The exercise template was successfully created | object |
| 400 | Invalid request body | object |
| 403 | Exceeds custom exercise limit | object |

### `GET /v1/exercise_templates/{exerciseTemplateId}`

Get a single exercise template by id.

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| path | `exerciseTemplateId` |  | Yes | — | The id of the exercise template |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | Success | [`ExerciseTemplate`](#exercisetemplate) |
| 404 | Exercise template not found | — |

## RoutineFolders

### `GET /v1/routine_folders`

Get a paginated list of routine folders available on the account.

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| query | `page` | integer | No | `1` | Page number (Must be 1 or greater) |
| query | `pageSize` | integer | No | `5` | Number of items on the requested page (Max 10) |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | A paginated list of routine folders | object |
| 400 | Invalid page size | — |

### `POST /v1/routine_folders`

Create a new routine folder. The folder will be created at index 0, and all other folders will have their indexes incremented.

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |

**Request body** (required): [`PostRoutineFolderRequestBody`](#postroutinefolderrequestbody)

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 201 | The routine folder was successfully created | [`RoutineFolder`](#routinefolder) |
| 400 | Invalid request body | object |

### `GET /v1/routine_folders/{folderId}`

Get a single routine folder by id.

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| path | `folderId` |  | Yes | — | The id of the routine folder |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | Success | [`RoutineFolder`](#routinefolder) |
| 404 | Routine folder not found | — |

## ExerciseHistory

### `GET /v1/exercise_history/{exerciseTemplateId}`

Get exercise history for a specific exercise template

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| path | `exerciseTemplateId` |  | Yes | — | The id of the exercise template |
| query | `start_date` | string (date-time) | No | — | Optional start date for filtering exercise history (ISO 8601 format) |
| query | `end_date` | string (date-time) | No | — | Optional end date for filtering exercise history (ISO 8601 format) |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | A list of exercise history entries | object |
| 400 | Invalid request parameters or date format | — |

## Measurements

### `GET /v1/body_measurements`

Get a paginated list of body measurements for the authenticated user

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| query | `page` | integer | No | `1` | Page number (Must be 1 or greater) |
| query | `pageSize` | integer | No | `10` | Number of items per page (Max 10) |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | A paginated list of body measurements | object |
| 400 | Invalid page or pageSize | — |
| 404 | Page not found | — |

### `POST /v1/body_measurements`

Create a body measurement entry for a given date. Returns 409 if an entry already exists for that date.

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |

**Request body** (required): [`BodyMeasurement`](#bodymeasurement)

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | The measurement was successfully created | — |
| 400 | Invalid request body | object |
| 409 | A measurement for this date already exists | object |

### `GET /v1/body_measurements/{date}`

Get a single body measurement by date

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| path | `date` | string (date) | Yes | — | The date of the body measurement (YYYY-MM-DD) |

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | The body measurement for the given date | [`BodyMeasurement`](#bodymeasurement) |
| 404 | Body measurement not found | object |

### `PUT /v1/body_measurements/{date}`

Update an existing body measurement entry for a given date. All fields are overwritten; omitted fields are set to null.

**Parameters**

| In | Name | Type | Required | Default | Description |
| -- | ---- | ---- | -------- | ------- | ----------- |
| header | `api-key` | string (uuid) | Yes | — |  |
| path | `date` | string (date) | Yes | — | The date of the measurement to update (YYYY-MM-DD) |

**Request body** (required): [`PutBodyMeasurement`](#putbodymeasurement)

**Responses**

| Code | Description | Body |
| ---- | ----------- | ---- |
| 200 | The measurement was successfully updated | — |
| 400 | Invalid request body | object |
| 404 | No measurement found for the given date | object |

---

## Schemas

### PostWorkoutsRequestSet

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `type` | string | No | The type of the set. One of: `warmup`, `normal`, `failure`, `dropset`. | `"normal"` |
| `weight_kg` | number | null | No | The weight in kilograms. | `100` |
| `reps` | integer | null | No | The number of repetitions. | `10` |
| `distance_meters` | integer | null | No | The distance in meters. | `null` |
| `duration_seconds` | integer | null | No | The duration in seconds. | `null` |
| `custom_metric` | number | null | No | A custom metric for the set. Currently used for steps and floors. | `null` |
| `rpe` | number | null | No | The Rating of Perceived Exertion (RPE). One of: `6`, `7`, `7.5`, `8`, `8.5`, `9`, `9.5`, `10`. | `null` |

### PostWorkoutsRequestExercise

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `exercise_template_id` | string | No | The ID of the exercise template. | `"D04AC939"` |
| `superset_id` | integer | null | No | The ID of the superset. | `null` |
| `notes` | string | null | No | Additional notes for the exercise. | `"Felt good today. Form was on point."` |
| `sets` | array of [`PostWorkoutsRequestSet`](#postworkoutsrequestset) | No |  | — |

### PostWorkoutsRequestBody

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `workout` | object | No |  | — |

**`PostWorkoutsRequestBody.workout`**

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `title` | string | No | The title of the workout. | `"Friday Leg Day 🔥"` |
| `description` | string | null | No | A description for the workout workout. | `"Medium intensity leg day focusing on quads."` |
| `start_time` | string | No | The time the workout started. | `"2024-08-14T12:00:00Z"` |
| `end_time` | string | No | The time the workout ended. | `"2024-08-14T12:30:00Z"` |
| `is_private` | boolean | No | A boolean indicating if the workout is private. | `false` |
| `exercises` | array of [`PostWorkoutsRequestExercise`](#postworkoutsrequestexercise) | No |  | — |

### PostRoutinesRequestSet

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `type` | string | No | The type of the set. One of: `warmup`, `normal`, `failure`, `dropset`. | `"normal"` |
| `weight_kg` | number | null | No | The weight in kilograms. | `100` |
| `reps` | integer | null | No | The number of repetitions. | `10` |
| `distance_meters` | integer | null | No | The distance in meters. | `null` |
| `duration_seconds` | integer | null | No | The duration in seconds. | `null` |
| `custom_metric` | number | null | No | A custom metric for the set. Currently used for steps and floors. | `null` |
| `rep_range` | object | null | No | Range of reps for the set, if applicable | — |

**`PostRoutinesRequestSet.rep_range`**

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `start` | number | No | Starting rep count for the range | `8` |
| `end` | number | No | Ending rep count for the range | `12` |

### PostRoutinesRequestExercise

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `exercise_template_id` | string | No | The ID of the exercise template. | `"D04AC939"` |
| `superset_id` | integer | null | No | The ID of the superset. | `null` |
| `rest_seconds` | integer | null | No | The rest time in seconds. | `90` |
| `notes` | string | null | No | Additional notes for the exercise. | `"Stay slow and controlled."` |
| `sets` | array of [`PostRoutinesRequestSet`](#postroutinesrequestset) | No |  | — |

### PostRoutinesRequestBody

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `routine` | object | No |  | — |

**`PostRoutinesRequestBody.routine`**

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `title` | string | No | The title of the routine. | `"April Leg Day 🔥"` |
| `folder_id` | number | null | No | The folder id the routine should be added to. Pass null to insert the routine into default "My Routines" folder | `null` |
| `notes` | string | No | Additional notes for the routine. | `"Focus on form over weight. Remember to stretch."` |
| `exercises` | array of [`PostRoutinesRequestExercise`](#postroutinesrequestexercise) | No |  | — |

### PutRoutinesRequestSet

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `type` | string | No | The type of the set. One of: `warmup`, `normal`, `failure`, `dropset`. | `"normal"` |
| `weight_kg` | number | null | No | The weight in kilograms. | `100` |
| `reps` | integer | null | No | The number of repetitions. | `10` |
| `distance_meters` | integer | null | No | The distance in meters. | `null` |
| `duration_seconds` | integer | null | No | The duration in seconds. | `null` |
| `custom_metric` | number | null | No | A custom metric for the set. Currently used for steps and floors. | `null` |
| `rep_range` | object | null | No | Range of reps for the set, if applicable | — |

**`PutRoutinesRequestSet.rep_range`**

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `start` | number | null | No | Starting rep count for the range | `8` |
| `end` | number | null | No | Ending rep count for the range | `12` |

### PutRoutinesRequestExercise

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `exercise_template_id` | string | No | The ID of the exercise template. | `"D04AC939"` |
| `superset_id` | integer | null | No | The ID of the superset. | `null` |
| `rest_seconds` | integer | null | No | The rest time in seconds. | `90` |
| `notes` | string | null | No | Additional notes for the exercise. | `"Stay slow and controlled."` |
| `sets` | array of [`PutRoutinesRequestSet`](#putroutinesrequestset) | No |  | — |

### PutRoutinesRequestBody

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `routine` | object | No |  | — |

**`PutRoutinesRequestBody.routine`**

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `title` | string | No | The title of the routine. | `"April Leg Day 🔥"` |
| `notes` | string | null | No | Additional notes for the routine. | `"Focus on form over weight. Remember to stretch."` |
| `exercises` | array of [`PutRoutinesRequestExercise`](#putroutinesrequestexercise) | No |  | — |

### PostRoutineFolderRequestBody

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `routine_folder` | object | No |  | — |

**`PostRoutineFolderRequestBody.routine_folder`**

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `title` | string | No | The title of the routine folder. | `"Push Pull 🏋️‍♂️"` |

### BodyMeasurement

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `date` | string (date) | Yes |  | `"2024-08-14"` |
| `weight_kg` | number | null | No |  | `80.5` |
| `lean_mass_kg` | number | null | No |  | `65` |
| `fat_percent` | number | null | No |  | `18.5` |
| `neck_cm` | number | null | No |  | `38` |
| `shoulder_cm` | number | null | No |  | `115` |
| `chest_cm` | number | null | No |  | `95` |
| `left_bicep_cm` | number | null | No |  | `35` |
| `right_bicep_cm` | number | null | No |  | `35.5` |
| `left_forearm_cm` | number | null | No |  | `28` |
| `right_forearm_cm` | number | null | No |  | `28.5` |
| `abdomen` | number | null | No |  | `85` |
| `waist` | number | null | No |  | `80` |
| `hips` | number | null | No |  | `95` |
| `left_thigh` | number | null | No |  | `55` |
| `right_thigh` | number | null | No |  | `55.5` |
| `left_calf` | number | null | No |  | `37` |
| `right_calf` | number | null | No |  | `37.5` |

### PutBodyMeasurement

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `weight_kg` | number | null | No |  | `80.5` |
| `lean_mass_kg` | number | null | No |  | `65` |
| `fat_percent` | number | null | No |  | `18.5` |
| `neck_cm` | number | null | No |  | `38` |
| `shoulder_cm` | number | null | No |  | `115` |
| `chest_cm` | number | null | No |  | `95` |
| `left_bicep_cm` | number | null | No |  | `35` |
| `right_bicep_cm` | number | null | No |  | `35.5` |
| `left_forearm_cm` | number | null | No |  | `28` |
| `right_forearm_cm` | number | null | No |  | `28.5` |
| `abdomen` | number | null | No |  | `85` |
| `waist` | number | null | No |  | `80` |
| `hips` | number | null | No |  | `95` |
| `left_thigh` | number | null | No |  | `55` |
| `right_thigh` | number | null | No |  | `55.5` |
| `left_calf` | number | null | No |  | `37` |
| `right_calf` | number | null | No |  | `37.5` |

### Set

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `index` | number | No | Index indicating the order of the set in the workout. | `0` |
| `type` | string | No | The type of set. This can be one of 'normal', 'warmup', 'dropset', 'failure' | `"normal"` |
| `weight_kg` | number | null | No | Weight lifted in kilograms. | `100` |
| `reps` | number | null | No | Number of reps logged for the set | `10` |
| `distance_meters` | number | null | No | Number of meters logged for the set | `null` |
| `duration_seconds` | number | null | No | Number of seconds logged for the set | `null` |
| `rpe` | number | null | No | RPE (Relative perceived exertion) value logged for the set | `9.5` |
| `custom_metric` | number | null | No | Custom metric logged for the set (Currently only used to log floors or steps for stair machine exercises) | `50` |

### Exercise

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `index` | number | No | Index indicating the order of the exercise in the workout. | `0` |
| `title` | string | No | Title of the exercise | `"Bench Press (Barbell)"` |
| `notes` | string | No | Notes on the exercise | `"Paid closer attention to form today. Felt great!"` |
| `exercise_template_id` | string | No | The id of the exercise template. This can be used to fetch the exercise template. | `"05293BCA"` |
| `supersets_id` | number | null | No | The id of the superset that the exercise belongs to. A value of null indicates the exercise is not part of a superset. | `0` |
| `sets` | array of [`Set`](#set) | No |  | — |

### ExerciseHistoryEntry

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `workout_id` | string | No | The workout ID | `"b459cba5-cd6d-463c-abd6-54f8eafcadcb"` |
| `workout_title` | string | No | The workout title | `"Morning Workout 💪"` |
| `workout_start_time` | string | No | ISO 8601 timestamp of when the workout was recorded to have started. | `"2024-01-01T12:00:00Z"` |
| `workout_end_time` | string | No | ISO 8601 timestamp of when the workout was recorded to have ended. | `"2024-01-01T13:00:00Z"` |
| `exercise_template_id` | string | No | The exercise template ID | `"D04AC939"` |
| `weight_kg` | number | null | No | The weight in kilograms | `100` |
| `reps` | integer | null | No | The number of repetitions | `10` |
| `distance_meters` | integer | null | No | The distance in meters | `null` |
| `duration_seconds` | integer | null | No | The duration in seconds | `null` |
| `rpe` | number | null | No | The Rating of Perceived Exertion | `8.5` |
| `custom_metric` | number | null | No | A custom metric for the set | `null` |
| `set_type` | string | No | The type of set (warmup, normal, failure, dropset) | `"normal"` |

### CustomExerciseType

```json
{
  "type": "enum",
  "enum": [
    "weight_reps",
    "reps_only",
    "bodyweight_reps",
    "bodyweight_assisted_reps",
    "duration",
    "weight_duration",
    "distance_duration",
    "short_distance_weight"
  ],
  "example": "weight_reps"
}
```

### MuscleGroup

```json
{
  "type": "enum",
  "enum": [
    "abdominals",
    "shoulders",
    "biceps",
    "triceps",
    "forearms",
    "quadriceps",
    "hamstrings",
    "calves",
    "glutes",
    "abductors",
    "adductors",
    "lats",
    "upper_back",
    "traps",
    "lower_back",
    "chest",
    "cardio",
    "neck",
    "full_body",
    "other"
  ],
  "example": "chest"
}
```

### EquipmentCategory

```json
{
  "type": "enum",
  "enum": [
    "none",
    "barbell",
    "dumbbell",
    "kettlebell",
    "machine",
    "plate",
    "resistance_band",
    "suspension",
    "other"
  ],
  "example": "barbell"
}
```

### ExerciseTemplate

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `id` | string | No | The exercise template ID. | `"b459cba5-cd6d-463c-abd6-54f8eafcadcb"` |
| `title` | string | No | The exercise title. | `"Bench Press (Barbell)"` |
| `type` | string | No | The exercise type. | `"weight_reps"` |
| `primary_muscle_group` | string | No | The primary muscle group of the exercise. | `"chest"` |
| `secondary_muscle_groups` | array of string | No | The secondary muscle groups of the exercise. | — |
| `is_custom` | boolean | No | A boolean indicating whether the exercise is a custom exercise. | `false` |

### CreateCustomExerciseRequestBody

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `exercise` | object | No |  | — |

**`CreateCustomExerciseRequestBody.exercise`**

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `title` | string | No | The title of the exercise template. | `"Bench Press"` |
| `exercise_type` | [`CustomExerciseType`](#customexercisetype) | No |  | — |
| `equipment_category` | [`EquipmentCategory`](#equipmentcategory) | No | The equipment category of the exercise template. | `"barbell"` |
| `muscle_group` | [`MuscleGroup`](#musclegroup) | No | The muscle group of the exercise template. | `"chest"` |
| `other_muscles` | array of [`MuscleGroup`](#musclegroup) | No | The other muscles of the exercise template. | `["biceps","triceps"]` |

### RoutineFolder

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `id` | number | No | The routine folder ID. | `42` |
| `index` | number | No | The routine folder index. Describes the order of the folder in the list. | `1` |
| `title` | string | No | The routine folder title. | `"Push Pull 🏋️‍♂️"` |
| `updated_at` | string | No | ISO 8601 timestamp of when the folder was last updated. | `"2021-09-14T12:00:00Z"` |
| `created_at` | string | No | ISO 8601 timestamp of when the folder was created. | `"2021-09-14T12:00:00Z"` |

### Routine

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `id` | string | No | The routine ID. | `"b459cba5-cd6d-463c-abd6-54f8eafcadcb"` |
| `title` | string | No | The routine title. | `"Upper Body 💪"` |
| `folder_id` | number | null | No | The routine folder ID. | `42` |
| `updated_at` | string | No | ISO 8601 timestamp of when the routine was last updated. | `"2021-09-14T12:00:00Z"` |
| `created_at` | string | No | ISO 8601 timestamp of when the routine was created. | `"2021-09-14T12:00:00Z"` |
| `exercises` | array of object | No |  | — |

**`Routine.exercises[]`**

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `index` | number | No | Index indicating the order of the exercise in the routine. | `0` |
| `title` | string | No | Title of the exercise | `"Bench Press (Barbell)"` |
| `rest_seconds` | string | No | The rest time in seconds between sets of the exercise | `60` |
| `notes` | string | No | Routine notes on the exercise | `"Focus on form. Go down to 90 degrees."` |
| `exercise_template_id` | string | No | The id of the exercise template. This can be used to fetch the exercise template. | `"05293BCA"` |
| `supersets_id` | number | null | No | The id of the superset that the exercise belongs to. A value of null indicates the exercise is not part of a superset. | `0` |
| `sets` | array of object | No |  | — |

**`Routine.exercises[].sets[]`**

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `index` | number | No | Index indicating the order of the set in the routine. | `0` |
| `type` | string | No | The type of set. This can be one of 'normal', 'warmup', 'dropset', 'failure' | `"normal"` |
| `weight_kg` | number | null | No | Weight lifted in kilograms. | `100` |
| `reps` | number | null | No | Number of reps logged for the set | `10` |
| `rep_range` | object | null | No | Range of reps for the set, if applicable | — |
| `distance_meters` | number | null | No | Number of meters logged for the set | `null` |
| `duration_seconds` | number | null | No | Number of seconds logged for the set | `null` |
| `rpe` | number | null | No | RPE (Relative perceived exertion) value logged for the set | `9.5` |
| `custom_metric` | number | null | No | Custom metric logged for the set (Currently only used to log floors or steps for stair machine exercises) | `50` |

### UserInfo

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `id` | string | No | The user ID. | `"9c465af3-de7d-42bc-9c7c-f0170396358b"` |
| `name` | string | No | The user's display name. | `"John doe"` |
| `url` | string | No | The user's public profile URL. | `"https://hevy.com/user/jhon"` |

### UserInfoResponse

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `data` | [`UserInfo`](#userinfo) | No |  | — |

### Workout

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `id` | string | No | The workout ID. | `"b459cba5-cd6d-463c-abd6-54f8eafcadcb"` |
| `title` | string | No | The workout title. | `"Morning Workout 💪"` |
| `routine_id` | string | No | The ID of the routine that this workout belongs to. | `"b459cba5-cd6d-463c-abd6-54f8eafcadcb"` |
| `description` | string | No | The workout description. | `"Pushed myself to the limit today!"` |
| `start_time` | string | No | ISO 8601 timestamp of when the workout was recorded to have started. | `"2021-09-14T12:00:00Z"` |
| `end_time` | string | No | ISO 8601 timestamp of when the workout was recorded to have ended. | `"2021-09-14T12:00:00Z"` |
| `updated_at` | string | No | ISO 8601 timestamp of when the workout was last updated. | `"2021-09-14T12:00:00Z"` |
| `created_at` | string | No | ISO 8601 timestamp of when the workout was created. | `"2021-09-14T12:00:00Z"` |
| `exercises` | array of object | No |  | — |

**`Workout.exercises[]`**

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `index` | number | No | Index indicating the order of the exercise in the workout. | `0` |
| `title` | string | No | Title of the exercise | `"Bench Press (Barbell)"` |
| `notes` | string | No | Notes on the exercise | `"Paid closer attention to form today. Felt great!"` |
| `exercise_template_id` | string | No | The id of the exercise template. This can be used to fetch the exercise template. | `"05293BCA"` |
| `supersets_id` | number | null | No | The id of the superset that the exercise belongs to. A value of null indicates the exercise is not part of a superset. | `0` |
| `sets` | array of object | No |  | — |

**`Workout.exercises[].sets[]`**

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `index` | number | No | Index indicating the order of the set in the workout. | `0` |
| `type` | string | No | The type of set. This can be one of 'normal', 'warmup', 'dropset', 'failure' | `"normal"` |
| `weight_kg` | number | null | No | Weight lifted in kilograms. | `100` |
| `reps` | number | null | No | Number of reps logged for the set | `10` |
| `distance_meters` | number | null | No | Number of meters logged for the set | `null` |
| `duration_seconds` | number | null | No | Number of seconds logged for the set | `null` |
| `rpe` | number | null | No | RPE (Relative perceived exertion) value logged for the set | `9.5` |
| `custom_metric` | number | null | No | Custom metric logged for the set (Currently only used to log floors or steps for stair machine exercises) | `50` |

### UpdatedWorkout

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `type` | string | Yes | Indicates the type of the event (updated) | `"updated"` |
| `workout` | [`Workout`](#workout) | Yes |  | — |

### DeletedWorkout

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `type` | string | Yes | Indicates the type of the event (deleted) | `"deleted"` |
| `id` | string | Yes | The unique identifier of the deleted workout | `"efe6801c-4aee-4959-bcdd-fca3f272821b"` |
| `deleted_at` | string | No | A date string indicating when the workout was deleted | `"2021-09-13T12:00:00Z"` |

### PaginatedWorkoutEvents

| Property | Type | Required | Description | Example |
| -------- | ---- | -------- | ----------- | ------- |
| `page` | integer | Yes | The current page number | `1` |
| `page_count` | integer | Yes | The total number of pages available | `5` |
| `events` | array of object | Yes | An array of workout events (either updated or deleted) | — |
