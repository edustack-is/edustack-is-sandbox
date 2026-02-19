/**
 * Script to wire DTO classes into controllers for Swagger schema visibility.
 * Adds @ApiBody({ type: XxxDto }) and @ApiResponse({ type: ErrorResponseDto }) references.
 * Run with: npx ts-node scripts/wire-swagger-dtos.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..', 'src');

// ─── WIRING RULES ──────────────────────────────────────
// Maps: controller file → method name → { bodyDto?, responseType? }
interface WiringRule {
    bodyDto?: string;
    responseType?: string;
    responseIsArray?: boolean;
}

const WIRING: Record<string, Record<string, WiringRule>> = {
    'auth/auth.controller.ts': {
        login: { bodyDto: 'LoginDto', responseType: 'LoginResponseDto' },
        acceptInvite: { bodyDto: 'AcceptInviteDto' },
        forgotPassword: { bodyDto: 'ForgotPasswordDto' },
        resetPassword: { bodyDto: 'ResetPasswordDto' },
        updateProfile: { bodyDto: 'UpdateProfileDto' },
        inviteUser: { bodyDto: 'InviteUserBodyDto' },
        getMe: { responseType: 'UserProfileDto' },
        getSchools: { responseType: 'SchoolListItemDto', responseIsArray: true },
        selectSchool: { responseType: 'SelectSchoolResponseDto' },
        refreshGlobal: { responseType: 'LoginResponseDto' },
        getSsoOptions: { responseType: 'SsoOptionDto', responseIsArray: true },
    },
    'grading/grading.controller.ts': {
        createGrade: { bodyDto: 'CreateGradeDto', responseType: 'GradeResponseDto' },
        updateGrade: { bodyDto: 'UpdateGradeDto', responseType: 'GradeResponseDto' },
        upsertReportCard: { bodyDto: 'UpsertReportCardDto' },
        polishVerbalEvaluation: { bodyDto: 'PolishTextDto' },
        upsertBehaviorGrade: { bodyDto: 'BehaviorGradeDto' },
        upsertCompetencyGrade: { bodyDto: 'CompetencyGradeDto' },
        createMeasure: { bodyDto: 'MeasureDto' },
        deleteGrade: { responseType: 'SuccessResponseDto' },
        deleteMeasure: { responseType: 'SuccessResponseDto' },
    },
    'attendance/attendance.controller.ts': {
        recordAttendance: { bodyDto: 'RecordAttendanceDto' },
        createExcuse: { bodyDto: 'CreateExcuseDto' },
        reviewExcuse: { bodyDto: 'ReviewExcuseDto' },
    },
    'schedule/schedule.controller.ts': {
        upsertTimeSlots: { bodyDto: 'UpsertTimeSlotsDto' },
        createEvent: { bodyDto: 'CreateScheduleEventDto' },
        updateEvent: { bodyDto: 'UpdateScheduleEventDto' },
        createSubstitution: { bodyDto: 'CreateSubstitutionDto' },
        deleteEvent: { responseType: 'SuccessResponseDto' },
        deleteSubstitution: { responseType: 'SuccessResponseDto' },
    },
    'messaging/messaging.controller.ts': {
        createConversation: { bodyDto: 'CreateConversationDto' },
        sendMessage: { bodyDto: 'SendMessageDto' },
        createClassBroadcast: { bodyDto: 'ClassBroadcastDto' },
        createSchoolBroadcast: { bodyDto: 'SchoolBroadcastDto' },
        getUnreadCount: { responseType: 'CountResponseDto' },
        markAsRead: { responseType: 'SuccessResponseDto' },
        markAllRead: { responseType: 'SuccessResponseDto' },
        toggleEmailNotifications: { bodyDto: '{ enabled: boolean }', responseType: 'ToggleResponseDto' },
    },
    'community/community.controller.ts': {
        createBulletinPost: { bodyDto: 'CreateBulletinPostDto' },
        createPoll: { bodyDto: 'CreatePollDto' },
        createCalendarEvent: { bodyDto: 'CreateCalendarEventDto' },
        rsvpEvent: { bodyDto: 'RsvpDto' },
        deleteBulletinPost: { responseType: 'SuccessResponseDto' },
        deletePoll: { responseType: 'SuccessResponseDto' },
        deleteCalendarEvent: { responseType: 'SuccessResponseDto' },
    },
    'classbook/classbook.controller.ts': {
        upsertEntry: { bodyDto: 'UpsertClassbookEntryDto' },
        signEntry: { responseType: 'SuccessResponseDto' },
    },
    'deputy/deputy.controller.ts': {
        createClassroom: { bodyDto: 'CreateClassroomDto' },
        createSubject: { bodyDto: 'CreateSubjectDto' },
        createRoom: { bodyDto: 'CreateRoomDto' },
        inviteUser: { bodyDto: 'InviteSchoolUserDto' },
        createEvent: { bodyDto: 'CreateSchoolEventDto' },
        deleteClassroom: { responseType: 'SuccessResponseDto' },
        deleteSubject: { responseType: 'SuccessResponseDto' },
        deleteRoom: { responseType: 'SuccessResponseDto' },
        deleteBuilding: { responseType: 'SuccessResponseDto' },
        deleteEvent: { responseType: 'SuccessResponseDto' },
        removeUser: { responseType: 'SuccessResponseDto' },
        exportUsersCsv: { responseType: 'SuccessResponseDto' },
    },
    'gdpr/gdpr.controller.ts': {
        deleteMyData: { responseType: 'SuccessResponseDto' },
    },
};

// All DTOs that may be referenced
const ALL_DTOS = new Set([
    'LoginDto', 'LoginResponseDto', 'AcceptInviteDto', 'ForgotPasswordDto',
    'ResetPasswordDto', 'SelectSchoolResponseDto', 'UserProfileDto',
    'SchoolListItemDto', 'SsoOptionDto', 'UpdateProfileDto', 'InviteUserBodyDto',
    'CreateGradeDto', 'UpdateGradeDto', 'GradeResponseDto', 'UpsertReportCardDto',
    'PolishTextDto', 'BehaviorGradeDto', 'CompetencyGradeDto', 'MeasureDto',
    'RecordAttendanceDto', 'AttendanceRecordItemDto', 'CreateExcuseDto', 'ReviewExcuseDto',
    'UpsertTimeSlotsDto', 'TimeSlotDto', 'CreateScheduleEventDto',
    'UpdateScheduleEventDto', 'CreateSubstitutionDto',
    'CreateConversationDto', 'SendMessageDto', 'ClassBroadcastDto', 'SchoolBroadcastDto',
    'CreateBulletinPostDto', 'CreatePollDto', 'CreateCalendarEventDto', 'RsvpDto',
    'UpsertClassbookEntryDto',
    'CreateClassroomDto', 'CreateSubjectDto', 'CreateRoomDto',
    'InviteSchoolUserDto', 'CreateSchoolEventDto',
    'SuccessResponseDto', 'CountResponseDto', 'ToggleResponseDto',
]);

let totalWired = 0;

for (const [relPath, methods] of Object.entries(WIRING)) {
    const filePath = path.join(SRC, relPath);
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  File not found: ${relPath}`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    let fileModified = false;

    // Collect all DTOs needed for this file
    const neededDtos = new Set<string>();
    for (const rule of Object.values(methods)) {
        if (rule.bodyDto && ALL_DTOS.has(rule.bodyDto)) neededDtos.add(rule.bodyDto);
        if (rule.responseType && ALL_DTOS.has(rule.responseType)) neededDtos.add(rule.responseType);
    }
    neededDtos.add('ErrorResponseDto');

    // Add DTO import if not present
    const dtoImportLine = `import { ${[...neededDtos].sort().join(', ')} } from '../common/dto/api.dto';`;
    const errorDtoImportLine = `import { ErrorResponseDto } from '../common/dto/error-response.dto';`;

    if (neededDtos.size > 1 && !content.includes("from '../common/dto/api.dto'")) {
        // Find location to add import (after last import)
        const lastImportEnd = content.lastIndexOf("import ");
        const nextNewline = content.indexOf('\n', lastImportEnd);
        const insertAt = content.indexOf('\n', nextNewline) + 1;
        content = content.slice(0, insertAt) + dtoImportLine + '\n' + content.slice(insertAt);
        fileModified = true;
    }

    if (!content.includes("from '../common/dto/error-response.dto'")) {
        const lastImportEnd = content.lastIndexOf("import ");
        const nextNewline = content.indexOf('\n', lastImportEnd);
        const insertAt = content.indexOf('\n', nextNewline) + 1;
        content = content.slice(0, insertAt) + errorDtoImportLine + '\n' + content.slice(insertAt);
        fileModified = true;
    }

    // Ensure ApiBody is imported
    if (!content.includes('ApiBody')) {
        content = content.replace(
            /import \{([^}]+)\} from '@nestjs\/swagger'/,
            (m, imports) => `import {${imports}, ApiBody } from '@nestjs/swagger'`
        );
        fileModified = true;
    }

    // Add type references to @ApiResponse error decorators
    // Replace: @ApiResponse({ status: 4xx, description: '...' })
    // With:    @ApiResponse({ status: 4xx, description: '...', type: ErrorResponseDto })
    content = content.replace(
        /@ApiResponse\(\{ status: (4\d\d), description: '([^']+)' \}\)/g,
        (match, status, desc) => {
            if (match.includes('type:')) return match; // Already has type
            return `@ApiResponse({ status: ${status}, description: '${desc}', type: ErrorResponseDto })`;
        }
    );

    // Add @ApiBody and/or success @ApiResponse for each method
    for (const [methodName, rule] of Object.entries(methods)) {
        // Add @ApiBody({ type: XxxDto }) before method if body DTO specified
        if (rule.bodyDto && ALL_DTOS.has(rule.bodyDto)) {
            const bodyTag = `@ApiBody({ type: ${rule.bodyDto} })`;
            if (!content.includes(bodyTag)) {
                const regex = new RegExp(`(\\s+)(@ApiOperation\\([^)]+\\))`, 'g');
                let match;
                while ((match = regex.exec(content)) !== null) {
                    // Check if this @ApiOperation is for the right method
                    const after = content.slice(match.index, match.index + 800);
                    if (after.includes(`async ${methodName}(`)) {
                        // Insert @ApiBody right after @ApiOperation line
                        const insertPos = match.index + match[0].length;
                        content = content.slice(0, insertPos) + `\n${match[1]}${bodyTag}` + content.slice(insertPos);
                        totalWired++;
                        fileModified = true;
                        break;
                    }
                }
            }
        }

        // Add success @ApiResponse({ type: XxxDto }) if response type specified
        if (rule.responseType && ALL_DTOS.has(rule.responseType)) {
            const isArray = rule.responseIsArray ? ', isArray: true' : '';
            const responseTag = `@ApiResponse({ status: 200, type: ${rule.responseType}${isArray} })`;
            const regex = new RegExp(`(\\s+)(@ApiOperation\\([^)]+\\))`, 'g');
            let match;
            while ((match = regex.exec(content)) !== null) {
                const after = content.slice(match.index, match.index + 800);
                if (after.includes(`async ${methodName}(`)) {
                    // Check if already has a success response
                    if (!after.includes(`status: 200, type: ${rule.responseType}`) && !after.includes(`status: 201, type: ${rule.responseType}`)) {
                        const insertPos = match.index + match[0].length;
                        content = content.slice(0, insertPos) + `\n${match[1]}${responseTag}` + content.slice(insertPos);
                        totalWired++;
                        fileModified = true;
                    }
                    break;
                }
            }
        }
    }

    if (fileModified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ ${relPath}`);
    }
}

// ─── Register all DTOs as extraModels in main.ts ────────
const mainPath = path.join(SRC, 'main.ts');
let mainContent = fs.readFileSync(mainPath, 'utf-8');

if (!mainContent.includes("from './common/dto/api.dto'")) {
    const dtoList = [
        'LoginDto', 'LoginResponseDto', 'AcceptInviteDto', 'ForgotPasswordDto',
        'ResetPasswordDto', 'SelectSchoolResponseDto', 'UserProfileDto',
        'SchoolListItemDto', 'SsoOptionDto',
        'CreateGradeDto', 'UpdateGradeDto', 'GradeResponseDto',
        'RecordAttendanceDto', 'AttendanceRecordItemDto',
        'CreateScheduleEventDto', 'CreateSubstitutionDto',
        'CreateConversationDto', 'SendMessageDto',
        'CreateBulletinPostDto', 'CreatePollDto', 'CreateCalendarEventDto',
        'UpsertClassbookEntryDto',
        'CreateClassroomDto', 'CreateSubjectDto', 'CreateRoomDto',
        'InviteSchoolUserDto',
        'SuccessResponseDto', 'CountResponseDto', 'ToggleResponseDto',
    ];

    mainContent = mainContent.replace(
        "import { ErrorResponseDto } from './common/dto/error-response.dto';",
        `import { ErrorResponseDto } from './common/dto/error-response.dto';\nimport { ${dtoList.join(', ')} } from './common/dto/api.dto';`
    );

    mainContent = mainContent.replace(
        'extraModels: [ErrorResponseDto]',
        `extraModels: [ErrorResponseDto, ${dtoList.join(', ')}]`
    );

    fs.writeFileSync(mainPath, mainContent, 'utf-8');
    console.log('✅ main.ts: registered extraModels');
}

console.log(`\n🎯 Total DTO wirings: ${totalWired}`);
