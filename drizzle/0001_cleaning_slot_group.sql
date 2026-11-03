ALTER TABLE `cleaning_booking` ADD `slot_group` text DEFAULT 'ALL' NOT NULL;--> statement-breakpoint
UPDATE `cleaning_booking` SET `slot_group` = CASE WHEN `hostel_id` = 't6' THEN 'ALL' ELSE COALESCE((SELECT UPPER(TRIM(`wing`)) FROM `student` WHERE `student`.`student_id` = `cleaning_booking`.`student_id`), 'ALL') END;--> statement-breakpoint
DROP INDEX `cleaning_slot_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `cleaning_slot_unique` ON `cleaning_booking` (`hostel_id`,`slot_group`,`floor`,`booking_date`,`slot_start`,`seat`);
